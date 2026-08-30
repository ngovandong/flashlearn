"""Shared HTTP/retry plumbing for AI providers.

Concrete providers (Gemini, DeepSeek, ...) subclass :class:`RetryingHttpProvider`
and only implement request building + response parsing; throttling, retries with
backoff, and transient-error handling live here so every provider behaves the
same way.
"""

import json
import logging
import random
import time
from typing import Any

import requests

from .logging_utils import extract_prompt_from_payload, extract_response_meta, log_ai_call
from .rate_limit import GlobalAiGate

logger = logging.getLogger(__name__)

# Transient statuses worth retrying in-process (overload, gateway errors).
# 429 (rate limit) is deliberately excluded: retrying would hold the global
# gate lock through the server's (often ~60s) Retry-After delay, starving every
# other request. Instead we fail fast so the failover layer can switch to
# another provider and put this one on cooldown.
_RETRY_STATUSES = {500, 502, 503, 504}
_RATE_LIMIT_STATUS = 429


class AiProviderError(RuntimeError):
    """Raised when an AI provider call fails or returns unusable output."""


class RetryingHttpProvider:
    """Base class providing throttling + retry/backoff around a POST request."""

    label = "AI"

    def __init__(
        self,
        *,
        timeout: int,
        max_retries: int,
        max_backoff: float,
        min_interval: float,
        verify: Any = True,
    ):
        self._timeout = timeout
        self._max_retries = max_retries
        self._max_backoff = max_backoff
        self._min_interval = min_interval
        self._verify = verify
        self._last_request_at = 0.0
        # Cross-process serializer + RPM limiter keyed by provider label, so the
        # web workers, RQ worker and cron backfill all share one Gemini budget.
        self._gate = GlobalAiGate(self.label)

    def _send(
        self, url: str, *, payload: dict, params: dict | None = None, headers: dict | None = None
    ) -> "requests.Response":
        """POST ``payload`` and return the raw 200 response, retrying transient errors.

        Centralizes the gate/throttle/backoff loop so callers can decode the body
        however they need (JSON for text models, raw bytes for audio/TTS).
        """
        last_error: AiProviderError | None = None
        model_name = str(getattr(self, "_model", getattr(self, "_tts_model", self.label)))
        prompt_text = extract_prompt_from_payload(payload)

        for attempt in range(self._max_retries + 1):
            start_time = time.monotonic()
            try:
                # Gate each attempt: only one provider request runs at a time
                # across all processes, and never more than the per-minute quota.
                # A retry re-enters the gate since it is another billable request.
                with self._gate.slot():
                    self._throttle()
                    response = requests.post(
                        url,
                        params=params,
                        headers=headers,
                        json=payload,
                        timeout=self._timeout,
                        verify=self._verify,
                    )
            except requests.RequestException as exc:
                duration_s = time.monotonic() - start_time
                last_error = AiProviderError(f"{self.label} request failed: {exc}")
                log_ai_call(
                    provider=self.label,
                    model=model_name,
                    input_text=prompt_text,
                    output_text="",
                    duration_s=duration_s,
                    status_code=0,
                    attempt=attempt + 1,
                    error=str(exc),
                )
                if attempt < self._max_retries:
                    self._backoff(attempt)
                    continue
                raise last_error from exc

            duration_s = time.monotonic() - start_time

            if response.status_code == 200:
                output_text = ""
                prompt_tokens = None
                completion_tokens = None
                try:
                    body_json = response.json()
                    output_text, prompt_tokens, completion_tokens = extract_response_meta(body_json)
                except Exception:
                    output_text = f"[Binary response: {len(response.content)} bytes]"

                log_ai_call(
                    provider=self.label,
                    model=model_name,
                    input_text=prompt_text,
                    output_text=output_text,
                    duration_s=duration_s,
                    status_code=200,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    attempt=attempt + 1,
                )
                return response

            err_msg = f"{self.label} status {response.status_code}: {response.text[:300]}"
            log_ai_call(
                provider=self.label,
                model=model_name,
                input_text=prompt_text,
                output_text="",
                duration_s=duration_s,
                status_code=response.status_code,
                attempt=attempt + 1,
                error=err_msg,
            )

            if response.status_code == _RATE_LIMIT_STATUS:
                # Don't retry rate limits in-process — give way to other
                # requests and let the failover layer pick another provider.
                server_delay = self._retry_delay(response)
                logger.warning(
                    "%s returned 429 (rate limited); not retrying%s",
                    self.label,
                    f", server suggested {round(server_delay, 1)}s" if server_delay is not None else "",
                )
                raise AiProviderError(f"{self.label} rate limited (429)")

            if response.status_code in _RETRY_STATUSES and attempt < self._max_retries:
                server_delay = self._retry_delay(response)
                logger.warning(
                    "%s returned %s (attempt %d/%d), retrying in %ss",
                    self.label,
                    response.status_code,
                    attempt + 1,
                    self._max_retries,
                    round(server_delay, 1) if server_delay is not None else "backoff",
                )
                self._backoff(attempt, server_delay=server_delay)
                continue

            logger.warning("%s returned %s: %s", self.label, response.status_code, response.text[:500])
            raise AiProviderError(f"{self.label} returned status {response.status_code}")

        raise last_error or AiProviderError(f"{self.label} request failed after retries")

    def _request_json(
        self, url: str, *, payload: dict, params: dict | None = None, headers: dict | None = None
    ) -> dict[str, Any]:
        """POST ``payload`` and return the decoded JSON body, retrying transient errors."""
        return self._send(url, payload=payload, params=params, headers=headers).json()

    def _request_bytes(
        self, url: str, *, payload: dict, params: dict | None = None, headers: dict | None = None
    ) -> bytes:
        """POST ``payload`` and return the raw response body (e.g. audio), with retries."""
        return self._send(url, payload=payload, params=params, headers=headers).content

    def _throttle(self) -> None:
        """Pace consecutive requests to stay under a per-minute quota."""
        if self._min_interval <= 0:
            return
        wait = self._min_interval - (time.monotonic() - self._last_request_at)
        if wait > 0:
            time.sleep(wait)
        self._last_request_at = time.monotonic()

    def _backoff(self, attempt: int, server_delay: float | None = None) -> None:
        """Sleep before a retry, honoring a server-specified delay when present."""
        if server_delay is not None:
            delay = min(server_delay + random.uniform(0, 1), self._max_backoff)
        else:
            delay = min(2**attempt + random.uniform(0, 1), self._max_backoff)
        time.sleep(delay)

    @staticmethod
    def _retry_delay(response: "requests.Response") -> float | None:
        """Recommended retry delay (seconds) from a Retry-After header, if any."""
        header = response.headers.get("Retry-After")
        if header:
            try:
                return float(header)
            except ValueError:
                pass
        return None

    @staticmethod
    def _loads_object(text: str, label: str) -> dict[str, Any]:
        if not isinstance(text, str):
            raise AiProviderError(f"{label} returned no text content")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise AiProviderError(f"{label} did not return valid JSON: {exc}") from exc
        if not isinstance(data, dict):
            raise AiProviderError(f"{label} JSON payload was not an object")
        return data

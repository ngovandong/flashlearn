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

logger = logging.getLogger(__name__)

# Transient statuses worth retrying (rate limit, overload, gateway errors).
_RETRY_STATUSES = {429, 500, 502, 503, 504}


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

    def _request_json(
        self, url: str, *, payload: dict, params: dict | None = None, headers: dict | None = None
    ) -> dict[str, Any]:
        """POST ``payload`` and return the decoded JSON body, retrying transient errors."""
        last_error: AiProviderError | None = None
        for attempt in range(self._max_retries + 1):
            self._throttle()
            try:
                response = requests.post(
                    url,
                    params=params,
                    headers=headers,
                    json=payload,
                    timeout=self._timeout,
                    verify=self._verify,
                )
            except requests.RequestException as exc:
                # Network errors / timeouts are usually transient — retry.
                last_error = AiProviderError(f"{self.label} request failed: {exc}")
                if attempt < self._max_retries:
                    self._backoff(attempt)
                    continue
                raise last_error from exc

            if response.status_code == 200:
                return response.json()

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

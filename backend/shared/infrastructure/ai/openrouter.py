"""OpenRouter implementation of :class:`AiTextPort`.

OpenRouter exposes an OpenAI-compatible Chat Completions API that proxies many
models, including several free-tier ones (model ids ending in ``:free``). Used
as an automatic backup when the primary provider is rate-limited or unavailable
(see :class:`FailoverAiProvider`).

By default we force a free-tier model and ask for JSON output; the expected
shape is described in the prompt since not every free model honors response
schemas.
"""

import json
import logging
import os
from typing import Any

from .base import AiProviderError, RetryingHttpProvider

logger = logging.getLogger(__name__)

_DEFAULT_BASE = "https://openrouter.ai/api/v1"
# A capable free-tier model that handles JSON well. Override with OPENROUTER_MODEL.
_DEFAULT_MODEL = "openai/gpt-oss-120b:free"
_FREE_SUFFIX = ":free"
_DEFAULT_TIMEOUT = 90
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_MAX_BACKOFF = 65


class OpenRouterProvider(RetryingHttpProvider):
    label = "OpenRouter"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        api_base: str | None = None,
        max_retries: int | None = None,
    ):
        super().__init__(
            timeout=int(os.getenv("OPENROUTER_TIMEOUT", str(_DEFAULT_TIMEOUT))),
            max_retries=(
                max_retries
                if max_retries is not None
                else int(os.getenv("OPENROUTER_MAX_RETRIES", str(_DEFAULT_MAX_RETRIES)))
            ),
            max_backoff=float(os.getenv("OPENROUTER_MAX_BACKOFF", str(_DEFAULT_MAX_BACKOFF))),
            min_interval=float(os.getenv("OPENROUTER_MIN_INTERVAL", "0")),
        )
        self._api_key = api_key if api_key is not None else os.getenv("OPENROUTER_API_KEY", "")
        self._api_base = (api_base or os.getenv("OPENROUTER_API_BASE", _DEFAULT_BASE)).rstrip("/")
        self._model = self._resolve_model(model or os.getenv("OPENROUTER_MODEL", _DEFAULT_MODEL))

    @staticmethod
    def _resolve_model(model: str) -> str:
        """Keep us on the free tier unless explicitly opted out.

        OPENROUTER_FORCE_FREE=false disables this; otherwise a non-``:free`` model
        id gets the suffix appended so we never spend credits by accident.
        """
        force_free = os.getenv("OPENROUTER_FORCE_FREE", "true").strip().lower() not in ("false", "0", "no")
        if force_free and model and not model.endswith(_FREE_SUFFIX):
            logger.info("Forcing OpenRouter free tier: %s -> %s%s", model, model, _FREE_SUFFIX)
            return model + _FREE_SUFFIX
        return model

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    def generate_json(self, system: str, user: str, schema: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.is_configured:
            raise AiProviderError("OPENROUTER_API_KEY is not configured")

        # Describe the JSON shape inline (free models may ignore response schemas);
        # the word "json" must appear for json_object mode.
        system_prompt = (system or "").strip()
        if schema:
            system_prompt += (
                "\n\nReturn your answer as a single json object that conforms to "
                "this JSON schema:\n" + json.dumps(schema)
            )
        else:
            system_prompt += "\n\nReturn your answer as a single json object."

        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.3,
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            # Optional attribution headers OpenRouter recommends.
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "https://flashlearn.app"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "FlashLearn"),
        }

        url = f"{self._api_base}/chat/completions"
        body = self._request_json(url, payload=payload, headers=headers)
        return self._parse(body)

    @staticmethod
    def _parse(body: dict[str, Any]) -> dict[str, Any]:
        # OpenRouter returns upstream provider errors in a 200 body sometimes.
        if isinstance(body, dict) and body.get("error"):
            raise AiProviderError(f"OpenRouter error: {body['error']}")
        try:
            choice = body["choices"][0]
            text = choice["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AiProviderError(f"Unexpected OpenRouter response shape: {exc}") from exc
        if not text:
            # Free models sometimes return empty content (e.g. finish_reason=length
            # or content moved to a reasoning field). Treat as a provider failure.
            raise AiProviderError(f"OpenRouter returned empty content (finish_reason={choice.get('finish_reason')})")
        return RetryingHttpProvider._loads_object(text, "OpenRouter")

"""LM Studio implementation of :class:`AiTextPort`.

LM Studio runs open-weight models locally and exposes an OpenAI-compatible Chat
Completions server (default ``http://localhost:1234/v1``). Use it to run the
text-only AI steps (e.g. grammar structuring/"explain") fully offline, with no
cloud quotas — handy when Gemini/OpenRouter are rate-limited.

Select it with ``AI_PROVIDER=lmstudio`` (optionally keep a cloud backup via
``AI_FALLBACK_PROVIDERS``). Config via ``LMSTUDIO_*`` env vars.
"""

import logging
import os
from typing import Any

from .base import AiProviderError, RetryingHttpProvider

logger = logging.getLogger(__name__)

_DEFAULT_BASE = "http://localhost:1234/v1"
# LM Studio routes to the currently loaded model when the id doesn't match, so a
# placeholder works; set LMSTUDIO_MODEL to be explicit.
_DEFAULT_MODEL = "local-model"
# Local models are slower than hosted APIs, so default to a generous timeout.
_DEFAULT_TIMEOUT = 300
_DEFAULT_MAX_RETRIES = 1
_DEFAULT_MAX_BACKOFF = 30

# Gemini uses uppercase type names in its schemas; standard JSON Schema (what LM
# Studio's structured-output grammar expects) uses lowercase.
_JSON_SCHEMA_TYPES = {
    "OBJECT": "object",
    "STRING": "string",
    "ARRAY": "array",
    "INTEGER": "integer",
    "NUMBER": "number",
    "BOOLEAN": "boolean",
    "NULL": "null",
}


def _to_json_schema(node: Any) -> Any:
    """Recursively convert a Gemini-style schema to standard JSON Schema."""
    if isinstance(node, dict):
        out: dict[str, Any] = {}
        for key, value in node.items():
            if key == "type" and isinstance(value, str):
                out[key] = _JSON_SCHEMA_TYPES.get(value.upper(), value)
            else:
                out[key] = _to_json_schema(value)
        return out
    if isinstance(node, list):
        return [_to_json_schema(item) for item in node]
    return node


class LMStudioProvider(RetryingHttpProvider):
    label = "LMStudio"

    def __init__(
        self,
        model: str | None = None,
        api_base: str | None = None,
        api_key: str | None = None,
        max_retries: int | None = None,
    ):
        super().__init__(
            timeout=int(os.getenv("LMSTUDIO_TIMEOUT", str(_DEFAULT_TIMEOUT))),
            max_retries=(
                max_retries
                if max_retries is not None
                else int(os.getenv("LMSTUDIO_MAX_RETRIES", str(_DEFAULT_MAX_RETRIES)))
            ),
            max_backoff=float(os.getenv("LMSTUDIO_MAX_BACKOFF", str(_DEFAULT_MAX_BACKOFF))),
            min_interval=float(os.getenv("LMSTUDIO_MIN_INTERVAL", "0")),
        )
        self._api_base = (api_base or os.getenv("LMSTUDIO_API_BASE", _DEFAULT_BASE)).rstrip("/")
        self._model = model or os.getenv("LMSTUDIO_MODEL", _DEFAULT_MODEL)
        # LM Studio ignores auth, but some proxies in front of it expect a bearer.
        self._api_key = api_key if api_key is not None else os.getenv("LMSTUDIO_API_KEY", "lm-studio")

    @property
    def is_configured(self) -> bool:
        # A local server has no credential to check; treat as available whenever a
        # base URL is set. If the server is down the request fails and failover
        # (if configured) moves on.
        return bool(self._api_base)

    def generate_json(
        self,
        system: str,
        user: str,
        schema: dict[str, Any] | None = None,
        audio: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if audio:
            raise AiProviderError("LM Studio provider does not support audio input")

        system_prompt = ((system or "").strip() + "\n\nReturn your answer as a single json object.").strip()

        # LM Studio enforces structured output via `json_schema` (json_object isn't
        # accepted). The app's schemas are Gemini-style (uppercase types), so
        # normalize them to standard JSON Schema before sending.
        if schema:
            response_format = {
                "type": "json_schema",
                "json_schema": {"name": "response", "strict": True, "schema": _to_json_schema(schema)},
            }
        else:
            response_format = {"type": "text"}

        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user},
            ],
            "response_format": response_format,
            # Deterministic extraction tasks want temperature 0; override per-run.
            "temperature": float(os.getenv("LMSTUDIO_TEMPERATURE", "0.3")),
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        url = f"{self._api_base}/chat/completions"
        body = self._request_json(url, payload=payload, headers=headers)
        return self._parse(body)

    @staticmethod
    def _parse(body: dict[str, Any]) -> dict[str, Any]:
        if isinstance(body, dict) and body.get("error"):
            raise AiProviderError(f"LM Studio error: {body['error']}")
        try:
            choice = body["choices"][0]
            message = choice["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AiProviderError(f"Unexpected LM Studio response shape: {exc}") from exc
        # Reasoning models (e.g. Qwen3) can emit the grammar-constrained JSON into
        # `reasoning_content` while leaving `content` empty; since the schema
        # forces valid JSON either way, fall back to it.
        text = (message.get("content") or "").strip() or (message.get("reasoning_content") or "").strip()
        if not text:
            raise AiProviderError(f"LM Studio returned empty content (finish_reason={choice.get('finish_reason')})")
        return RetryingHttpProvider._loads_object(text, "LM Studio")

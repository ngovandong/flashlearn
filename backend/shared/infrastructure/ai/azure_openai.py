"""Azure OpenAI implementation of :class:`AiTextPort`.

Talks to an Azure OpenAI resource through its OpenAI-compatible **v1** API
(``https://<resource>.openai.azure.com/openai/v1``). Unlike the classic Azure
API this endpoint is versionless and takes the *deployment name* as ``model``.
Authentication uses the ``api-key`` header (data-plane key).

Config via ``AZURE_OPENAI_*`` env vars:

* ``AZURE_OPENAI_API_KEY``    — data-plane key
* ``AZURE_OPENAI_ENDPOINT``   — base ending in ``/openai/v1``
* ``AZURE_OPENAI_DEPLOYMENT`` — the deployment name to call (e.g. ``gpt-4.1``)

Select it with ``AI_PROVIDER=azure_openai`` or ``build_named_provider('azure_openai')``.
A capable chat model (gpt-4o-2024-08-06+/gpt-4.1) supports strict JSON-schema
structured output, which we request when a schema is given.
"""

import os
from typing import Any

from .base import AiProviderError, RetryingHttpProvider
from .lmstudio import _to_json_schema

_DEFAULT_BASE = "https://dongngo2001-6602-resource.openai.azure.com/openai/v1"
_DEFAULT_TIMEOUT = 180
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_MAX_BACKOFF = 60


class AzureOpenAIProvider(RetryingHttpProvider):
    label = "AzureOpenAI"

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        max_retries: int | None = None,
    ):
        super().__init__(
            timeout=int(os.getenv("AZURE_OPENAI_TIMEOUT", str(_DEFAULT_TIMEOUT))),
            max_retries=(
                max_retries
                if max_retries is not None
                else int(os.getenv("AZURE_OPENAI_MAX_RETRIES", str(_DEFAULT_MAX_RETRIES)))
            ),
            max_backoff=float(os.getenv("AZURE_OPENAI_MAX_BACKOFF", str(_DEFAULT_MAX_BACKOFF))),
            min_interval=float(os.getenv("AZURE_OPENAI_MIN_INTERVAL", "0")),
        )
        self._api_key = api_key if api_key is not None else os.getenv("AZURE_OPENAI_API_KEY", "")
        self._api_base = (api_base or os.getenv("AZURE_OPENAI_ENDPOINT", _DEFAULT_BASE)).rstrip("/")
        # Azure calls the deployment by name via the `model` field.
        self._model = model or os.getenv("AZURE_OPENAI_DEPLOYMENT", "")

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key and self._model)

    def generate_json(
        self,
        system: str,
        user: str,
        schema: dict[str, Any] | None = None,
        audio: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if not self._api_key:
            raise AiProviderError("AZURE_OPENAI_API_KEY is not configured")
        if not self._model:
            raise AiProviderError("AZURE_OPENAI_DEPLOYMENT is not configured (the model/deployment name)")
        if audio:
            raise AiProviderError("Azure OpenAI provider does not support audio input")

        system_prompt = ((system or "").strip() + "\n\nReturn your answer as a single json object.").strip()
        if schema:
            # Non-strict json_schema: strict mode would require additionalProperties:false
            # and every property in `required`, which the app's schemas (with optional
            # fields) don't satisfy. Non-strict still guides the model by the schema.
            response_format = {
                "type": "json_schema",
                "json_schema": {"name": "response", "strict": False, "schema": _to_json_schema(schema)},
            }
        else:
            response_format = {"type": "json_object"}

        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user},
            ],
            "response_format": response_format,
            "stream": False,
        }
        # gpt-5.x reasoning models only accept the default temperature and reject the
        # parameter otherwise, so only send it when explicitly configured.
        temp = os.getenv("AZURE_OPENAI_TEMPERATURE", "").strip()
        if temp:
            payload["temperature"] = float(temp)
        headers = {"api-key": self._api_key, "Content-Type": "application/json"}
        url = f"{self._api_base}/chat/completions"
        body = self._request_json(url, payload=payload, headers=headers)
        return self._parse(body)

    @staticmethod
    def _parse(body: dict[str, Any]) -> dict[str, Any]:
        if isinstance(body, dict) and body.get("error"):
            raise AiProviderError(f"Azure OpenAI error: {body['error']}")
        try:
            choice = body["choices"][0]
            text = choice["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AiProviderError(f"Unexpected Azure OpenAI response shape: {exc}") from exc
        if not text:
            raise AiProviderError(f"Azure OpenAI returned empty content (finish_reason={choice.get('finish_reason')})")
        return RetryingHttpProvider._loads_object(text, "Azure OpenAI")

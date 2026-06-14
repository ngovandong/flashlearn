"""Google Gemini implementation of :class:`AiTextPort`.

Uses the Generative Language REST API with the existing ``requests`` dependency
(no extra SDK), so swapping providers only means adding a sibling module.
"""

import os
from typing import Any

import requests

from .base import AiProviderError, RetryingHttpProvider

_DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta"
_DEFAULT_MODEL = "gemini-3.1-flash-lite"
# Text-to-speech model (override with GEMINI_TTS_MODEL). Gemini only exposes
# TTS via *-preview models over the REST generateContent API; the non-preview
# native-audio models use bidiGenerateContent (live streaming) instead.
_DEFAULT_TTS_MODEL = "gemini-3.1-flash-tts-preview"
_DEFAULT_TIMEOUT = 90
_DEFAULT_MAX_RETRIES = 5
# Cap for a single backoff sleep. Free-tier 429s can ask for ~60s waits, so this
# must be high enough to honor them.
_DEFAULT_MAX_BACKOFF = 65


class GeminiProvider(RetryingHttpProvider):
    label = "Gemini"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        api_base: str | None = None,
        max_retries: int | None = None,
    ):
        super().__init__(
            timeout=int(os.getenv("GEMINI_TIMEOUT", str(_DEFAULT_TIMEOUT))),
            max_retries=(
                max_retries
                if max_retries is not None
                else int(os.getenv("GEMINI_MAX_RETRIES", str(_DEFAULT_MAX_RETRIES)))
            ),
            max_backoff=float(os.getenv("GEMINI_MAX_BACKOFF", str(_DEFAULT_MAX_BACKOFF))),
            # Min seconds between requests to proactively stay under the RPM quota.
            min_interval=float(os.getenv("GEMINI_MIN_INTERVAL", "0")),
            verify=self._resolve_verify(),
        )
        self._api_key = api_key if api_key is not None else os.getenv("GEMINI_API_KEY", "")
        self._model = model or os.getenv("GEMINI_MODEL", _DEFAULT_MODEL)
        self._tts_model = os.getenv("GEMINI_TTS_MODEL", _DEFAULT_TTS_MODEL)
        self._api_base = (api_base or os.getenv("GEMINI_API_BASE", _DEFAULT_BASE)).rstrip("/")

    @staticmethod
    def _resolve_verify():
        """TLS verification setting passed to requests.

        - GEMINI_VERIFY_SSL=false disables verification (debug only).
        - GEMINI_CA_BUNDLE points at a custom CA bundle (e.g. corporate root).
        - Otherwise default verification (which still honors REQUESTS_CA_BUNDLE).
        """
        if os.getenv("GEMINI_VERIFY_SSL", "true").strip().lower() in ("false", "0", "no"):
            return False
        return os.getenv("GEMINI_CA_BUNDLE") or True

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    def generate_json(
        self,
        system: str,
        user: str,
        schema: dict[str, Any] | None = None,
        audio: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if not self.is_configured:
            raise AiProviderError("GEMINI_API_KEY is not configured")

        url = f"{self._api_base}/models/{self._model}:generateContent"
        generation_config: dict[str, Any] = {"responseMimeType": "application/json"}
        if schema:
            generation_config["responseSchema"] = schema

        parts: list[dict[str, Any]] = [{"text": user}]
        if audio:
            # Gemini accepts inline audio as a base64 blob alongside the prompt.
            parts.append({"inlineData": {"mimeType": audio["mime_type"], "data": audio["data"]}})

        payload: dict[str, Any] = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": generation_config,
        }
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}

        body = self._request_json(url, params={"key": self._api_key}, payload=payload)
        return self._parse(body)

    def generate_speech(self, text: str, voice: str = "Kore") -> dict[str, str]:
        """Synthesize ``text`` to speech with a Gemini prebuilt voice.

        Returns ``{"audio": base64, "mime_type": str}`` where ``audio`` is raw
        16-bit PCM (mono, typically 24 kHz) that the client decodes with the Web
        Audio API. Uses the official (non-preview) TTS model by default.
        """
        if not self.is_configured:
            raise AiProviderError("GEMINI_API_KEY is not configured")

        url = f"{self._api_base}/models/{self._tts_model}:generateContent"
        payload: dict[str, Any] = {
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
            },
        }
        body = self._request_json(url, params={"key": self._api_key}, payload=payload)
        return self._parse_audio(body)

    @staticmethod
    def _parse_audio(body: dict[str, Any]) -> dict[str, str]:
        try:
            inline = body["candidates"][0]["content"]["parts"][0]["inlineData"]
            data = inline["data"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AiProviderError(f"Unexpected Gemini TTS response shape: {exc}") from exc
        if not data:
            raise AiProviderError("Gemini TTS returned empty audio")
        return {"audio": data, "mime_type": inline.get("mimeType", "audio/L16;rate=24000")}

    @staticmethod
    def _retry_delay(response: "requests.Response") -> float | None:
        """Gemini reports the wait for 429 quota errors in the body (retryInfo)."""
        header = response.headers.get("Retry-After")
        if header:
            try:
                return float(header)
            except ValueError:
                pass
        try:
            for detail in response.json().get("error", {}).get("details", []):
                raw = detail.get("retryDelay")
                if raw and raw.endswith("s"):
                    return float(raw[:-1])
        except (ValueError, AttributeError):
            pass
        return None

    @staticmethod
    def _parse(body: dict[str, Any]) -> dict[str, Any]:
        try:
            text = body["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AiProviderError(f"Unexpected Gemini response shape: {exc}") from exc
        return RetryingHttpProvider._loads_object(text, "Gemini")

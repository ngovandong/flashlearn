"""ElevenLabs text-to-speech implementation.

ElevenLabs is the active TTS provider for the Speaking Coach (Gemini is kept as
a legacy provider so conversations generated with its prebuilt voices still
play). Unlike the text providers this only implements :meth:`generate_speech`:
the endpoint streams back binary MP3 audio which we base64-encode to match the
``{"audio": base64, "mime_type": str}`` contract the rest of the app expects.

Uses the existing ``requests`` dependency (no extra SDK) and reuses the shared
gate/retry plumbing in :class:`RetryingHttpProvider`.
"""

import base64
import os
from typing import Any

from .base import AiProviderError, RetryingHttpProvider
from .rate_limit import GlobalAiGate

_DEFAULT_BASE = "https://api.elevenlabs.io/v1"
# eleven_multilingual_v2 is the most natural/consistent model for a learning
# reference voice. Override with ELEVENLABS_TTS_MODEL (e.g. eleven_flash_v2_5
# for lower latency).
_DEFAULT_MODEL = "eleven_multilingual_v2"
# MP3 the browser decodes with the Web Audio API.
_DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"
_DEFAULT_TIMEOUT = 90
_DEFAULT_MAX_RETRIES = 2
_DEFAULT_MAX_BACKOFF = 30


class ElevenLabsProvider(RetryingHttpProvider):
    label = "ElevenLabs"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        api_base: str | None = None,
        output_format: str | None = None,
        max_retries: int | None = None,
    ):
        super().__init__(
            timeout=int(os.getenv("ELEVENLABS_TIMEOUT", str(_DEFAULT_TIMEOUT))),
            max_retries=(
                max_retries
                if max_retries is not None
                else int(os.getenv("ELEVENLABS_MAX_RETRIES", str(_DEFAULT_MAX_RETRIES)))
            ),
            max_backoff=float(os.getenv("ELEVENLABS_MAX_BACKOFF", str(_DEFAULT_MAX_BACKOFF))),
            min_interval=float(os.getenv("ELEVENLABS_MIN_INTERVAL", "0")),
        )
        self._api_key = api_key if api_key is not None else os.getenv("ELEVENLABS_API_KEY", "")
        self._model = model or os.getenv("ELEVENLABS_TTS_MODEL", _DEFAULT_MODEL)
        self._api_base = (api_base or os.getenv("ELEVENLABS_API_BASE", _DEFAULT_BASE)).rstrip("/")
        self._output_format = output_format or os.getenv("ELEVENLABS_OUTPUT_FORMAT", _DEFAULT_OUTPUT_FORMAT)
        # ElevenLabs' limits are about concurrency/monthly credits, not a tight
        # per-minute quota like Gemini's, so the global rate-limit gate (one-at-a-
        # time + RPM) is disabled here — no serialization or throttle delay. Set
        # AI_GATE_ENABLED_ELEVENLABS=true to re-enable it if you ever hit limits.
        gate_enabled = os.getenv("AI_GATE_ENABLED_ELEVENLABS", "false").strip().lower() in ("true", "1", "yes")
        self._gate = GlobalAiGate(self.label, enabled=gate_enabled)

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    def generate_speech(self, text: str, voice: str) -> dict[str, str]:
        """Synthesize ``text`` to speech with an ElevenLabs voice id.

        Returns ``{"audio": base64, "mime_type": "audio/mpeg"}`` — base64-encoded
        MP3 the client decodes with the Web Audio API.
        """
        if not self.is_configured:
            raise AiProviderError("ELEVENLABS_API_KEY is not configured")
        text = (text or "").strip()
        if not text:
            raise AiProviderError("text is required for speech synthesis")
        if not voice:
            raise AiProviderError("an ElevenLabs voice id is required")

        url = f"{self._api_base}/text-to-speech/{voice}"
        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload: dict[str, Any] = {"text": text, "model_id": self._model}
        audio = self._request_bytes(
            url, payload=payload, params={"output_format": self._output_format}, headers=headers
        )
        if not audio:
            raise AiProviderError("ElevenLabs returned empty audio")
        return {"audio": base64.b64encode(audio).decode("ascii"), "mime_type": "audio/mpeg"}

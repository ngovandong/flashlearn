"""Azure AI Speech — Text-to-Speech (REST synthesis API).

Synthesizes speech from text with Azure's neural voices over the REST endpoint
(no Speech SDK, consistent with the other providers). Used to give every course
dialogue character a fixed voice that matches their name and gender, so the
generated audio is consistent across every lesson. Returns MP3 audio that the
browser decodes with the Web Audio API.
"""

import base64
import logging
import os
import random
import time

# escape() only escapes text for safe SSML output; it does not parse untrusted XML.
from xml.sax.saxutils import escape  # nosec B406

import requests

from .base import AiProviderError

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 30
_DEFAULT_MAX_RETRIES = 2
_RETRY_STATUSES = {429, 500, 502, 503, 504}
# Azure neural voices render natively at 24 kHz, so a higher *bitrate* (not a
# higher sample rate) is what removes the compressed/robotic feel. 96 kbit/s is a
# clean default for speech; override with AZURE_TTS_OUTPUT_FORMAT for max quality
# (e.g. "audio-24khz-160kbitrate-mono-mp3" or "audio-48khz-192kbitrate-mono-mp3").
_DEFAULT_OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3"


class AzureTextToSpeechProvider:
    """Azure Speech text-to-speech over the REST synthesis API."""

    label = "AzureTTS"

    def __init__(
        self,
        api_key: str | None = None,
        region: str | None = None,
        timeout: int | None = None,
        max_retries: int | None = None,
        output_format: str | None = None,
    ):
        # Shares the pronunciation-assessment credentials (same Speech resource).
        self._api_key = api_key if api_key is not None else os.getenv("AZURE_SPEECH_KEY", "")
        self._region = (region or os.getenv("AZURE_SPEECH_REGION", "")).strip().lower()
        self._timeout = timeout or int(os.getenv("AZURE_SPEECH_TIMEOUT", str(_DEFAULT_TIMEOUT)))
        self._max_retries = (
            max_retries
            if max_retries is not None
            else int(os.getenv("AZURE_SPEECH_MAX_RETRIES", str(_DEFAULT_MAX_RETRIES)))
        )
        self._output_format = output_format or os.getenv("AZURE_TTS_OUTPUT_FORMAT", _DEFAULT_OUTPUT_FORMAT)

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key and self._region)

    def synthesize(self, text: str, voice: str, *, language: str | None = None) -> dict:
        """Synthesize ``text`` in ``voice``; return ``{"audio": base64, "mime_type"}``."""
        text = (text or "").strip()
        if not text:
            raise AiProviderError("Azure TTS received empty text")
        if not voice:
            raise AiProviderError("Azure TTS requires a voice name")
        if not self.is_configured:
            raise AiProviderError("Azure TTS is not configured (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION)")

        lang = language or self._voice_lang(voice)
        ssml = (
            f"<speak version='1.0' xml:lang='{lang}'>"
            f"<voice xml:lang='{lang}' name='{voice}'>{escape(text)}</voice>"
            "</speak>"
        )
        url = f"https://{self._region}.tts.speech.microsoft.com/cognitiveservices/v1"
        headers = {
            "Ocp-Apim-Subscription-Key": self._api_key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": self._output_format,
            "User-Agent": "flashlearn-course-tts",
        }
        audio = self._post(url, headers=headers, data=ssml.encode("utf-8"))
        return {"audio": base64.b64encode(audio).decode("ascii"), "mime_type": "audio/mpeg"}

    @staticmethod
    def _voice_lang(voice: str) -> str:
        # Azure voice ids look like "en-US-JennyNeural"; the locale is the first
        # two dash-separated segments.
        parts = (voice or "").split("-")
        if len(parts) >= 2:
            return f"{parts[0]}-{parts[1]}"
        return "en-US"

    def _post(self, url: str, *, headers: dict, data: bytes) -> bytes:
        last_error: AiProviderError | None = None
        for attempt in range(self._max_retries + 1):
            try:
                response = requests.post(url, headers=headers, data=data, timeout=self._timeout)
            except requests.RequestException as exc:
                last_error = AiProviderError(f"{self.label} request failed: {exc}")
                if attempt < self._max_retries:
                    time.sleep(min(2**attempt + random.uniform(0, 1), 10))
                    continue
                raise last_error from exc

            if response.status_code == 200 and response.content:
                return response.content

            if response.status_code in _RETRY_STATUSES and attempt < self._max_retries:
                time.sleep(min(2**attempt + random.uniform(0, 1), 10))
                continue

            logger.warning("%s returned %s: %s", self.label, response.status_code, response.text[:300])
            raise AiProviderError(f"{self.label} returned status {response.status_code}")

        raise last_error or AiProviderError(f"{self.label} request failed after retries")

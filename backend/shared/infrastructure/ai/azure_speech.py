"""Azure AI Speech — Pronunciation Assessment (REST short-audio API).

Unlike the text providers, this does not implement :class:`AiTextPort`. It posts
recorded audio to the Speech service and returns Azure's *measured* pronunciation
scores (accuracy / fluency / completeness / prosody) down to the word, syllable
and phoneme level, which is far more reliable than asking a multimodal LLM to
"listen and guess".

We use the REST short-audio endpoint (audio < 60s) with the ``requests``
dependency to stay consistent with the other providers — no Speech SDK. The
endpoint only accepts ``audio/wav; codecs=audio/pcm; samplerate=16000`` or
``audio/ogg; codecs=opus``, so the browser uploads 16 kHz mono WAV.
"""

import base64
import json
import logging
import os
import random
import time

import requests

from .base import AiProviderError

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 30
_DEFAULT_MAX_RETRIES = 2
_RETRY_STATUSES = {429, 500, 502, 503, 504}


class AzureSpeechProvider:
    """Azure Speech pronunciation assessment over the REST short-audio API."""

    label = "AzureSpeech"

    def __init__(
        self,
        api_key: str | None = None,
        region: str | None = None,
        timeout: int | None = None,
        max_retries: int | None = None,
    ):
        self._api_key = api_key if api_key is not None else os.getenv("AZURE_SPEECH_KEY", "")
        self._region = (region or os.getenv("AZURE_SPEECH_REGION", "")).strip().lower()
        self._language = os.getenv("AZURE_SPEECH_LANGUAGE", "en-US")
        self._timeout = timeout or int(os.getenv("AZURE_SPEECH_TIMEOUT", str(_DEFAULT_TIMEOUT)))
        self._max_retries = (
            max_retries
            if max_retries is not None
            else int(os.getenv("AZURE_SPEECH_MAX_RETRIES", str(_DEFAULT_MAX_RETRIES)))
        )

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key and self._region)

    def assess_pronunciation(
        self,
        audio_base64: str,
        reference_text: str,
        *,
        mime_type: str = "audio/wav",
        language: str | None = None,
    ) -> dict:
        """Return Azure's detailed pronunciation-assessment JSON for one utterance.

        ``audio_base64`` is the recording (16 kHz mono WAV, base64 without the
        ``data:`` prefix). Raises :class:`AiProviderError` on any failure so the
        caller can fall back to the multimodal listener.
        """
        if not self.is_configured:
            raise AiProviderError("Azure Speech is not configured (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION)")
        try:
            audio_bytes = base64.b64decode(audio_base64 or "")
        except (ValueError, TypeError) as exc:
            raise AiProviderError(f"Azure Speech received undecodable audio: {exc}") from exc
        if not audio_bytes:
            raise AiProviderError("Azure Speech received empty audio")

        url = f"https://{self._region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
        params = {"format": "detailed", "language": language or self._language}
        headers = {
            "Accept": "application/json",
            "Ocp-Apim-Subscription-Key": self._api_key,
            "Content-Type": self._content_type(mime_type),
            "Pronunciation-Assessment": self._assessment_header(reference_text),
        }

        body = self._post(url, params=params, headers=headers, data=audio_bytes)
        status = body.get("RecognitionStatus")
        if status not in ("Success", 0) or not body.get("NBest"):
            raise AiProviderError(f"Azure Speech returned no usable result (RecognitionStatus={status!r})")
        return body

    @staticmethod
    def _content_type(mime_type: str) -> str:
        mime = (mime_type or "").lower()
        if "ogg" in mime or "opus" in mime:
            return "audio/ogg; codecs=opus"
        return "audio/wav; codecs=audio/pcm; samplerate=16000"

    @staticmethod
    def _assessment_header(reference_text: str) -> str:
        params = {
            "ReferenceText": reference_text or "",
            "GradingSystem": "HundredMark",
            "Granularity": "Phoneme",
            "Dimension": "Comprehensive",
            "EnableProsodyAssessment": "True",
            "EnableMiscue": "True",
            "PhonemeAlphabet": "IPA",
            "NBestPhonemeCount": "5",
        }
        return base64.b64encode(json.dumps(params).encode("utf-8")).decode("ascii")

    def _post(self, url: str, *, params: dict, headers: dict, data: bytes) -> dict:
        last_error: AiProviderError | None = None
        for attempt in range(self._max_retries + 1):
            try:
                response = requests.post(url, params=params, headers=headers, data=data, timeout=self._timeout)
            except requests.RequestException as exc:
                last_error = AiProviderError(f"{self.label} request failed: {exc}")
                if attempt < self._max_retries:
                    time.sleep(min(2**attempt + random.uniform(0, 1), 10))
                    continue
                raise last_error from exc

            if response.status_code == 200:
                try:
                    return response.json()
                except ValueError as exc:
                    raise AiProviderError(f"{self.label} returned non-JSON body: {exc}") from exc

            if response.status_code in _RETRY_STATUSES and attempt < self._max_retries:
                time.sleep(min(2**attempt + random.uniform(0, 1), 10))
                continue

            logger.warning("%s returned %s: %s", self.label, response.status_code, response.text[:500])
            raise AiProviderError(f"{self.label} returned status {response.status_code}")

        raise last_error or AiProviderError(f"{self.label} request failed after retries")

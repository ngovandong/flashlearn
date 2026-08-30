"""Kokoro-82M — local, open-source text-to-speech (offline).

Runs the Apache-2.0 `Kokoro-82M <https://huggingface.co/hexgrad/Kokoro-82M>`_
model on this machine instead of calling an external TTS API, so course
dialogue audio can be regenerated for free with a more natural-sounding voice.
Returns 24 kHz mono WAV (base64) to match the ``{"audio": base64, "mime_type"}``
contract the rest of the app uses.

Heavy dependencies (``kokoro`` pulls in ``torch``) are intentionally lazy: the
provider only imports them on first synthesis, so the rest of the app keeps
booting without them. Install with::

    uv sync --group tts
    brew install espeak-ng   # phoneme fallback for out-of-vocabulary words
"""

import base64
import importlib.util
import io
import logging
import os
import time
import wave

from .base import AiProviderError
from .logging_utils import log_ai_call

logger = logging.getLogger(__name__)

# Kokoro synthesizes at a fixed 24 kHz; the WAV header must match.
_SAMPLE_RATE = 24000
_REPO_ID = "hexgrad/Kokoro-82M"


class KokoroTtsProvider:
    """Local Kokoro-82M synthesis with the same interface as the cloud TTS providers."""

    label = "Kokoro"

    def __init__(self, lang_code: str | None = None, speed: float | None = None):
        # Voice names start with an accent letter ("a" = American English) which is
        # also the pipeline's lang_code; this is just the fallback when a voice
        # doesn't encode one.
        self._default_lang = (lang_code or os.getenv("KOKORO_LANG_CODE", "a")).strip() or "a"
        self._speed = speed if speed is not None else float(os.getenv("KOKORO_SPEED", "1"))
        # One pipeline per lang_code, loaded on demand and reused across lines.
        self._pipelines: dict[str, object] = {}
        self._pipeline_cls = None

    @property
    def is_configured(self) -> bool:
        """True when the optional ``kokoro`` package is importable (model downloads
        lazily on first use)."""
        return importlib.util.find_spec("kokoro") is not None

    def synthesize(self, text: str, voice: str, *, language: str | None = None) -> dict[str, str]:
        """Synthesize ``text`` in ``voice``; return ``{"audio": base64 wav, "mime_type"}``."""
        text = (text or "").strip()
        if not text:
            raise AiProviderError("Kokoro received empty text")
        if not voice:
            raise AiProviderError("Kokoro requires a voice name (e.g. af_heart, am_michael)")

        start_time = time.monotonic()
        lang = (language or "").strip() or (voice[0] if voice[0].isalpha() else self._default_lang)
        pipeline = self._ensure_pipeline(lang)

        import numpy as np

        chunks = []
        for _, _, audio in pipeline(text, voice=voice, speed=self._speed):
            if audio is None:
                continue
            arr = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
            chunks.append(arr.astype(np.float32))
        if not chunks:
            duration_s = time.monotonic() - start_time
            log_ai_call(
                provider=self.label,
                model=voice,
                input_text=text,
                output_text="",
                duration_s=duration_s,
                status_code=500,
                error=f"Kokoro produced no audio for voice {voice!r}",
            )
            raise AiProviderError(f"Kokoro produced no audio for voice {voice!r}")
        samples = np.concatenate(chunks)
        encoded_audio = self._encode_wav(samples)
        duration_s = time.monotonic() - start_time

        log_ai_call(
            provider=self.label,
            model=voice,
            input_text=text,
            output_text=f"[Kokoro WAV generated: {len(encoded_audio)} chars]",
            duration_s=duration_s,
            status_code=200,
        )

        return {"audio": encoded_audio, "mime_type": "audio/wav"}

    def _ensure_pipeline(self, lang_code: str):
        if self._pipeline_cls is None:
            try:
                from kokoro import KPipeline
            except Exception as exc:  # noqa: BLE001 — surface a single actionable error
                raise AiProviderError(
                    "Kokoro is not installed. Run `uv sync --group tts` (and "
                    f"`brew install espeak-ng`) to enable the local TTS. ({exc})"
                ) from exc
            self._pipeline_cls = KPipeline
        if lang_code not in self._pipelines:
            logger.info("Loading Kokoro pipeline (lang_code=%s)…", lang_code)
            self._pipelines[lang_code] = self._pipeline_cls(repo_id=_REPO_ID, lang_code=lang_code)
        return self._pipelines[lang_code]

    @staticmethod
    def _encode_wav(samples) -> str:
        import numpy as np

        clipped = np.clip(samples, -1.0, 1.0)
        pcm16 = (clipped * 32767.0).astype("<i2")
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(_SAMPLE_RATE)
            wav.writeframes(pcm16.tobytes())
        return base64.b64encode(buf.getvalue()).decode("ascii")

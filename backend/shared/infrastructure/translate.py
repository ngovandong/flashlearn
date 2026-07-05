"""Free machine-translation adapter.

Wraps Google's public (unauthenticated) translate endpoint — the same one the
legacy ``TranslateView`` uses — behind a small port so application services can
depend on the abstraction and fall back to an AI provider when it fails.
"""

import logging

import requests

logger = logging.getLogger(__name__)

_GOOGLE_TRANSLATE_URL = "https://translate.google.com/translate_a/single"


class GoogleTranslateProvider:
    """Best-effort translation via Google's free ``gtx`` endpoint."""

    label = "google"

    def translate(self, text: str, target_language: str = "vi", source_language: str = "auto") -> str:
        text = (text or "").strip()
        if not text:
            return ""
        params = {
            "client": "gtx",
            "sl": source_language,
            "tl": target_language,
            "hl": target_language,
            "dt": "t",
            "q": text,
        }
        try:
            response = requests.get(_GOOGLE_TRANSLATE_URL, params=params, timeout=10)
            data = response.json()
        except Exception:  # noqa: BLE001 — caller falls back to the AI provider
            logger.warning("Google translate failed for %r", text[:48])
            return ""
        return "".join(line[0] for line in data[0] if line and isinstance(line[0], str))


default_translator = GoogleTranslateProvider()

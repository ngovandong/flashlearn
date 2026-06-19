"""Speaking Coach application service.

All AI prompts, rules and JSON schemas for the Speaking Coach live here so the
frontend stays a pure UI layer. It is provider-agnostic and depends only on
:class:`AiTextPort`; the concrete provider is injected from the composition root.

Pronunciation analysis sends recorded audio to the model, which requires a
multimodal-capable provider (Gemini). Conversation/topic generation is plain
text/JSON and can use any provider in the failover chain.
"""

import json
import logging
import os
from typing import Any

from backend.shared.infrastructure.ai import AiProviderError, build_named_provider, default_ai_provider

logger = logging.getLogger(__name__)

ACCENT_LABELS = {
    "US": "American English",
    "UK": "British English",
    "AU": "Australian English",
}

# ─── Tutor voices ────────────────────────────────────────────────────────────
# Two TTS providers coexist. ElevenLabs is the active provider for NEW
# conversations (Gemini's TTS has a very tight rate limit). Gemini is kept as a
# LEGACY provider so conversations generated with its prebuilt voices still play
# with their original voice — those legacy voices are only ever shown in the UI
# when an old conversation that used one is opened.

# Legacy Gemini prebuilt voices (voice name == provider param).
GEMINI_TTS_VOICES: dict[str, str] = {
    "Kore": "Kore — Warm & clear",
    "Puck": "Puck — Upbeat",
    "Charon": "Charon — Deep & calm",
    "Fenrir": "Fenrir — Energetic",
    "Zephyr": "Zephyr — Bright",
}
LEGACY_DEFAULT_VOICE = "Kore"

# Active ElevenLabs voices (stable premade-library voice ids). Each voice speaks
# a fixed native accent, so the picker shows the voices matching the chosen
# accent (US/UK/AU) and the default voice switches when the accent changes.
ELEVENLABS_VOICES: list[dict[str, str]] = [
    # American (US)
    {"id": "TX3LPaxmHKxFdv7VOQHJ", "label": "Liam — Energetic", "accent": "US"},
    {"id": "EXAVITQu4vr4xnSDxMaL", "label": "Sarah — Warm & clear", "accent": "US"},
    {"id": "cgSgspJ2msm6clMCkdW9", "label": "Jessica — Expressive", "accent": "US"},
    {"id": "cjVigY5qzO86Huf0OWal", "label": "Eric — Calm", "accent": "US"},
    {"id": "nPczCjzI2devNBz1zQrb", "label": "Brian — Deep", "accent": "US"},
    # British (UK)
    {"id": "JBFqnCBsd6RMkjVDRZzb", "label": "George — Mature & calm", "accent": "UK"},
    {"id": "pFZP5JQG7iQjIQuC4Bku", "label": "Lily — Warm", "accent": "UK"},
    {"id": "Xb7hH8MSUJpSbSDYk0k2", "label": "Alice — Confident", "accent": "UK"},
    {"id": "onwK4e9ZLuTAKqWW03F9", "label": "Daniel — Authoritative", "accent": "UK"},
    # Australian (AU)
    {"id": "IKne3meq5aSn9XLyUdCD", "label": "Charlie — Casual", "accent": "AU"},
]

# id -> label (used for cache keys / labelling) and id -> accent.
ELEVENLABS_TTS_VOICES: dict[str, str] = {v["id"]: v["label"] for v in ELEVENLABS_VOICES}
ELEVENLABS_VOICE_ACCENT: dict[str, str] = {v["id"]: v["accent"] for v in ELEVENLABS_VOICES}

# Default voice per accent (first voice listed for that accent).
ELEVENLABS_ACCENT_DEFAULT: dict[str, str] = {}
for _v in ELEVENLABS_VOICES:
    ELEVENLABS_ACCENT_DEFAULT.setdefault(_v["accent"], _v["id"])

# Global default for new conversations before an accent is chosen (US / Liam).
DEFAULT_ELEVENLABS_VOICE = ELEVENLABS_ACCENT_DEFAULT.get("US") or ELEVENLABS_VOICES[0]["id"]

# Whether ElevenLabs is wired up (an API key is present). When it isn't, the app
# falls back to the legacy Gemini voices so the feature keeps working.
ELEVENLABS_ENABLED = bool(os.getenv("ELEVENLABS_API_KEY", "").strip())

# Voices offered for NEW conversations + the default selection.
ACTIVE_TTS_VOICES: dict[str, str] = ELEVENLABS_TTS_VOICES if ELEVENLABS_ENABLED else GEMINI_TTS_VOICES
DEFAULT_TTS_VOICE = DEFAULT_ELEVENLABS_VOICE if ELEVENLABS_ENABLED else LEGACY_DEFAULT_VOICE

# Every recognized voice (active + legacy) — used to validate/replay any voice a
# saved conversation or cached clip might reference.
TTS_VOICES: list[str] = list(dict.fromkeys([*ACTIVE_TTS_VOICES, *GEMINI_TTS_VOICES]))


def voice_label(voice: str) -> str:
    """Human-readable label for a voice id from either provider."""
    return ELEVENLABS_TTS_VOICES.get(voice) or GEMINI_TTS_VOICES.get(voice) or voice


def is_elevenlabs_voice(voice: str) -> bool:
    return voice in ELEVENLABS_TTS_VOICES


# Sample line played when previewing a voice in the picker. Must match the
# frontend's ``VOICE_DEMO_TEXT`` so the pre-cached clips are a cache hit.
VOICE_DEMO_TEXT = "Hi! This is how I sound. Let's practice speaking together."

# Gemini structured-output schemas (uppercase OpenAPI types).
_CONVERSATION_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "topic": {"type": "STRING"},
        "context": {"type": "STRING"},
        "lines": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "id": {"type": "STRING"},
                    "speaker": {"type": "STRING"},
                    "text": {"type": "STRING"},
                },
                "required": ["id", "speaker", "text"],
            },
        },
    },
    "required": ["topic", "context", "lines"],
}

_TOPICS_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {"topics": {"type": "ARRAY", "items": {"type": "STRING"}}},
    "required": ["topics"],
}

_WORD_ANALYSIS_ITEM: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "word": {"type": "STRING"},
        "status": {"type": "STRING", "enum": ["correct", "incorrect", "missing"]},
        "userPronunciation": {"type": "STRING"},
        "correctPronunciation": {"type": "STRING"},
        "ipaTarget": {"type": "STRING"},
        "ipaSpoken": {"type": "STRING"},
        "mouthTip": {"type": "STRING"},
        "syllableStress": {"type": "STRING"},
        "feedback": {"type": "STRING"},
    },
    "required": ["word", "status"],
}

_KEY_STRUGGLE_ITEM: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "sound": {"type": "STRING"},
        "description": {"type": "STRING"},
        "tip": {"type": "STRING"},
    },
    "required": ["sound", "description", "tip"],
}

_ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "transcription": {"type": "STRING"},
        "accuracyScore": {"type": "NUMBER"},
        "fluencyScore": {"type": "NUMBER"},
        "completenessScore": {"type": "NUMBER"},
        "rhythmScore": {"type": "NUMBER"},
        "wordsPerMinute": {"type": "NUMBER"},
        "accentAnalysis": {"type": "STRING"},
        "overallFeedback": {"type": "STRING"},
        "keyStruggles": {"type": "ARRAY", "items": _KEY_STRUGGLE_ITEM},
        "wordAnalysis": {"type": "ARRAY", "items": _WORD_ANALYSIS_ITEM},
    },
    "required": ["transcription", "accuracyScore", "wordAnalysis"],
}

_CONVERSATION_SYSTEM = (
    "You are an English speaking coach for a flashcard study app. You design short, "
    "realistic two-person dialogues for pronunciation and conversation practice. "
    "Always answer with a single JSON object matching the requested schema. Give every "
    "line a unique 'id' (e.g. 'l1', 'l2', ...)."
)

_ANALYSIS_RULES = (
    "1. Listen to the user's audio and transcribe it accurately into 'transcription'.\n"
    "2. Score each dimension 0-100: accuracyScore (phonetic accuracy of words/sounds), "
    "fluencyScore (smoothness, natural pausing, rhythm), completenessScore (whether all "
    "target words were spoken), rhythmScore (sentence stress, weak forms, contractions).\n"
    "3. Estimate speaking rate as wordsPerMinute (typical 110-165).\n"
    "4. In 'accentAnalysis', comment on regional features, vowel shaping or flat intonation.\n"
    "5. List 1-3 'keyStruggles' (tricky phonemes, e.g. /θ/, /r/) each with a description of "
    "what happened and a physical 'tip' for tongue/lip placement.\n"
    "6. Provide a word-by-word 'wordAnalysis' for the target text: word, status "
    "(correct|incorrect|missing), userPronunciation (plain spelling of what was said), "
    "correctPronunciation, ipaTarget (e.g. /ˈkɔː.fi/), ipaSpoken, mouthTip, syllableStress, "
    "and a short friendly 'feedback'."
)

_EXPLAIN_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "meaning": {"type": "STRING"},
        "ipaExplanation": {"type": "STRING"},
        "mouthTip": {"type": "STRING"},
    },
    "required": ["meaning"],
}

_EXPLAIN_SYSTEM = (
    "You are a friendly English speaking coach. Explain a selected word or phrase for a "
    "language learner in the context it appeared. Always answer with a single JSON object "
    "matching the requested schema."
)

# Turns Azure's measured findings into human coaching text (no audio involved).
_COACHING_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "overallFeedback": {"type": "STRING"},
        "keyStruggles": {"type": "ARRAY", "items": _KEY_STRUGGLE_ITEM},
        "wordTips": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {"word": {"type": "STRING"}, "mouthTip": {"type": "STRING"}},
                "required": ["word", "mouthTip"],
            },
        },
    },
    "required": ["overallFeedback"],
}

_COACHING_SYSTEM = (
    "You are an encouraging English speaking coach. Given measured pronunciation results, write "
    "concise, actionable coaching. Always answer with a single JSON object matching the requested schema."
)


class SpeakingCoachService:
    """AI operations for the Speaking Coach feature.

    ``ai`` handles text/JSON generation (conversations, topics, phrase hints).
    ``audio_ai`` must be multimodal-capable and is used for pronunciation
    analysis; it defaults to a Gemini provider since the failover chain may
    include text-only backups.
    """

    def __init__(
        self,
        ai: Any = default_ai_provider,
        audio_ai: Any | None = None,
        tts: Any | None = None,
        pronunciation: Any | None = None,
    ):
        self._ai = ai
        self._audio_ai = audio_ai or build_named_provider("gemini")
        # Active TTS provider (ElevenLabs). Falls back to the legacy Gemini
        # provider when ElevenLabs has no API key configured.
        self._tts = tts if tts is not None else (build_named_provider("elevenlabs") if ELEVENLABS_ENABLED else None)
        # Optional dedicated pronunciation assessor (Azure Speech). When present
        # it produces measured scores; otherwise we fall back to the multimodal
        # listener (``audio_ai``) which estimates them.
        self._pron = pronunciation

    def generate_conversation(
        self,
        topic: str,
        accent: str = "US",
        user_name: str = "Me",
        partner_name: str = "Coach",
        custom_text: str | None = None,
        level: str | None = None,
        tone: str | None = None,
        turns: int = 6,
        vocabulary: list[str] | None = None,
    ) -> dict[str, Any]:
        dialect = ACCENT_LABELS.get(accent, ACCENT_LABELS["US"])
        turns = max(2, min(int(turns or 6), 16))
        speaker_rule = (
            f'The conversation is between "{user_name}" and "{partner_name}". '
            "Use these exact names for the 'speaker' field, alternating turns."
        )
        level_rule = (
            f"Match the complexity (vocabulary, sentence length, idioms, grammar) to CEFR level {level} "
            "(A1/A2 simple, B1/B2 conversational, C1/C2 native-like)."
            if level
            else ""
        )
        tone_rule = f"The conversation tone must be: {tone}." if tone else ""

        if vocabulary:
            words = ", ".join(vocabulary)
            user_prompt = (
                "Create a realistic, natural everyday conversation for English speaking practice. "
                "Choose a common, relatable scenario yourself.\n"
                f"{speaker_rule}\nUse {dialect}. The dialogue must have exactly {turns} turns.\n"
                f"{level_rule}\n{tone_rule}\n"
                "Naturally weave in SOME of the learner's saved vocabulary listed below, but only "
                "where it genuinely fits. Do NOT force words in or cram them: aim for roughly 3-10 "
                "of these words across the dialogue, and if only a few fit the scenario naturally, "
                "use just 1-2. A natural, meaningful, realistic conversation matters far more than "
                "the number of words used.\n"
                f"Saved vocabulary: {words}\n"
                "Set 'topic' to a concise, descriptive title (max 4 words) that fits the dialogue, "
                "and include a short 'context'."
            )
        elif custom_text and custom_text.strip():
            user_prompt = (
                "Restructure the following text into a natural practice dialogue.\n"
                f'Text: "{custom_text.strip()}"\n'
                f"{speaker_rule}\nUse {dialect}. The dialogue must have exactly {turns} turns.\n"
                f"{level_rule}\n{tone_rule}"
            )
        else:
            user_prompt = (
                f'Generate a realistic everyday conversation about "{topic or "Ordering coffee at a cafe"}".\n'
                f"{speaker_rule}\nUse {dialect}. Include a short 'context'. "
                f"The dialogue must have exactly {turns} turns.\n{level_rule}\n{tone_rule}"
            )

        raw = self._ai.generate_json(_CONVERSATION_SYSTEM, user_prompt, _CONVERSATION_SCHEMA)
        return self._normalize_conversation(raw, topic)

    def suggest_topics(self, history: list[str] | None = None) -> list[str]:
        recent = ", ".join((history or [])[-5:])
        user_prompt = (
            "Suggest 5 everyday English conversation practice topics, each 2-4 words. "
            f'Avoid these recent ones: [{recent}]. Return JSON {{"topics": []}}.'
        )
        try:
            raw = self._ai.generate_json(
                "You suggest concise English conversation practice topics as JSON.",
                user_prompt,
                _TOPICS_SCHEMA,
            )
        except Exception:
            logger.exception("Failed to suggest speaking topics")
            return ["Ordering Coffee", "Job Interview", "Airport Check-in", "Making Plans", "At the Doctor"]
        topics = [t.strip() for t in (raw.get("topics") or []) if isinstance(t, str) and t.strip()]
        return topics[:5] or ["Ordering Coffee", "Job Interview", "Airport Check-in"]

    def analyze_pronunciation(
        self, target_text: str, audio_base64: str, mime_type: str = "audio/webm", full_session: bool = False
    ) -> dict[str, Any]:
        if not (audio_base64 or "").strip():
            raise ValueError("audio is required for pronunciation analysis")

        # Prefer Azure's measured assessment when configured; fall back to the
        # multimodal listener on any failure so analysis always returns something.
        if self._pron is not None and getattr(self._pron, "is_configured", False):
            try:
                raw = self._pron.assess_pronunciation(audio_base64, target_text, mime_type=mime_type)
                result = self._map_azure_analysis(raw, target_text)
                self._enrich_with_coaching(result, full_session)
                return result
            except AiProviderError:
                logger.exception("Azure pronunciation assessment failed; falling back to the AI listener")

        return self._analyze_with_listener(target_text, audio_base64, mime_type, full_session)

    def _analyze_with_listener(
        self, target_text: str, audio_base64: str, mime_type: str, full_session: bool
    ) -> dict[str, Any]:
        if full_session:
            system = (
                "You are an English speaking coach evaluating a full multi-turn role-play session. "
                "Always answer with a single JSON object matching the requested schema."
            )
            task = (
                "TASK: Evaluate the user's full spoken role-play.\n"
                f'Full target dialogue (the user spoke their lines): "{target_text}"\n'
                "Provide an encouraging 'overallFeedback' summarizing flow, pace and consistency.\n" + _ANALYSIS_RULES
            )
        else:
            system = (
                "You are an English speaking coach performing deep phonological pronunciation analysis. "
                "Always answer with a single JSON object matching the requested schema."
            )
            task = (
                "TASK: Analyze the user's pronunciation of one sentence.\n"
                f'Target sentence the user attempted: "{target_text}"\n' + _ANALYSIS_RULES
            )

        raw = self._audio_ai.generate_json(
            system, task, _ANALYSIS_SCHEMA, audio={"mime_type": mime_type, "data": audio_base64}
        )
        return self._normalize_analysis(raw)

    # ── Azure pronunciation assessment → analysis schema ──────────────────
    _AZURE_STATUS = {"None": "correct", "Mispronunciation": "incorrect", "Omission": "missing"}

    @staticmethod
    def _assessment(obj: dict[str, Any]) -> dict[str, Any]:
        """Scores holder for ``obj``.

        The REST short-audio API puts pronunciation scores directly on the
        NBest/Word object, while the SDK JSON nests them under
        ``PronunciationAssessment`` — tolerate both shapes.
        """
        if isinstance(obj, dict):
            nested = obj.get("PronunciationAssessment")
            return nested if isinstance(nested, dict) else obj
        return {}

    @classmethod
    def _map_azure_analysis(cls, raw: dict[str, Any], reference_text: str) -> dict[str, Any]:
        """Map Azure's detailed REST result to the frontend analysis schema."""
        nbest = (raw.get("NBest") or [{}])[0]
        assessment = cls._assessment(nbest)
        words_raw = nbest.get("Words") or []

        words: list[dict[str, Any]] = []
        for item in words_raw:
            word = _str(item.get("Word"))
            wa = cls._assessment(item)
            error = wa.get("ErrorType") or "None"
            # Insertions are extra words not in the target; they don't belong on
            # the target-sentence map.
            if not word or error == "Insertion":
                continue
            phonemes = item.get("Phonemes") or []
            syllables = item.get("Syllables") or []
            accuracy = _int(wa.get("AccuracyScore"))
            words.append(
                {
                    "word": word,
                    "status": cls._AZURE_STATUS.get(error, "incorrect"),
                    "accuracyScore": accuracy,
                    "userPronunciation": "",
                    "correctPronunciation": "",
                    "ipaTarget": cls._join_ipa(p.get("Phoneme") for p in phonemes),
                    "ipaSpoken": cls._join_ipa(cls._top_phoneme(p) for p in phonemes),
                    "mouthTip": "",
                    "syllableStress": " · ".join(_str(s.get("Syllable")) for s in syllables if _str(s.get("Syllable"))),
                    "feedback": cls._word_feedback(error, accuracy),
                }
            )

        return {
            "transcription": _str(nbest.get("Display") or raw.get("DisplayText") or nbest.get("Lexical")),
            "accuracyScore": _int(assessment.get("AccuracyScore")),
            "fluencyScore": _int(assessment.get("FluencyScore")),
            "completenessScore": _int(assessment.get("CompletenessScore")),
            # Prosody (stress/intonation/rhythm) maps to the UI's "rhythm" metric;
            # fall back to fluency when prosody wasn't returned.
            "rhythmScore": _int(assessment.get("ProsodyScore")) or _int(assessment.get("FluencyScore")),
            "wordsPerMinute": cls._words_per_minute(words_raw),
            "accentAnalysis": "",
            "overallFeedback": "",
            "keyStruggles": [],
            "wordAnalysis": words,
        }

    @staticmethod
    def _join_ipa(phonemes) -> str:
        joined = "".join(_str(p) for p in phonemes if _str(p))
        return f"/{joined}/" if joined else ""

    @classmethod
    def _top_phoneme(cls, phoneme: dict[str, Any]) -> str:
        """The most likely actually-spoken phoneme (top N-best), else the expected one."""
        nbest = cls._assessment(phoneme).get("NBestPhonemes") or []
        if nbest:
            return _str(nbest[0].get("Phoneme")) or _str(phoneme.get("Phoneme"))
        return _str(phoneme.get("Phoneme"))

    @staticmethod
    def _word_feedback(error: str, accuracy: int) -> str:
        if error == "Omission":
            return "This word wasn't detected — make sure to say it clearly."
        if error in ("Mispronunciation", "Insertion") or accuracy < 60:
            return f"Accuracy {accuracy}% — focus on the highlighted sounds."
        if accuracy < 80:
            return f"Accuracy {accuracy}% — close, refine the trickier sounds."
        return "Clear and accurate."

    @classmethod
    def _words_per_minute(cls, words_raw: list[dict[str, Any]]) -> int:
        spans = [
            (item["Offset"], item["Duration"])
            for item in words_raw
            if isinstance(item, dict)
            and isinstance(item.get("Offset"), int | float)
            and isinstance(item.get("Duration"), int | float)
            and cls._assessment(item).get("ErrorType") != "Omission"
        ]
        if not spans:
            return 0
        start = min(offset for offset, _ in spans)
        end = max(offset + duration for offset, duration in spans)
        seconds = (end - start) / 10_000_000  # Azure ticks are 100ns units.
        return round(len(spans) / seconds * 60) if seconds > 0 else 0

    def _enrich_with_coaching(self, result: dict[str, Any], full_session: bool) -> None:
        """Add friendly coaching text (struggles, mouth tips, summary) in place.

        Azure gives the hard numbers but no human guidance, so a single text-LLM
        pass turns its findings into tips. Best-effort: any failure leaves the
        measured scores intact.
        """
        struggles = [w for w in result["wordAnalysis"] if w["status"] != "correct"]
        if not struggles and not full_session:
            return
        focus = [
            {"word": w["word"], "ipaTarget": w["ipaTarget"], "ipaSpoken": w["ipaSpoken"], "status": w["status"]}
            for w in struggles[:8]
        ]
        scope = "a full multi-turn role-play session" if full_session else "one sentence"
        user_prompt = (
            f'A learner practiced {scope}. Transcription: "{result["transcription"]}".\n'
            f"Overall accuracy {result['accuracyScore']}%, fluency {result['fluencyScore']}%, "
            f"rhythm {result['rhythmScore']}%.\n"
            f"Mispronounced/missed words (target vs detected IPA): {json.dumps(focus)}\n"
            "Provide: 'overallFeedback' (1-2 encouraging sentences), 'keyStruggles' (up to 3 tricky "
            "sounds, each with a 'description' and a physical 'tip' for tongue/lip placement), and "
            "'wordTips' (a short 'mouthTip' for each listed word)."
        )
        try:
            raw = self._ai.generate_json(_COACHING_SYSTEM, user_prompt, _COACHING_SCHEMA)
        except Exception:
            logger.exception("Pronunciation coaching enrichment failed; returning measured scores only")
            return

        result["overallFeedback"] = _str(raw.get("overallFeedback")) or result["overallFeedback"]
        result["keyStruggles"] = [
            {"sound": _str(s.get("sound")), "description": _str(s.get("description")), "tip": _str(s.get("tip"))}
            for s in (raw.get("keyStruggles") or [])
            if isinstance(s, dict) and _str(s.get("sound"))
        ]
        tips = {
            _str(t.get("word")).lower(): _str(t.get("mouthTip"))
            for t in (raw.get("wordTips") or [])
            if isinstance(t, dict) and _str(t.get("word"))
        }
        for word in result["wordAnalysis"]:
            tip = tips.get(word["word"].lower())
            if tip:
                word["mouthTip"] = tip

    def synthesize_speech(self, text: str, voice: str = DEFAULT_TTS_VOICE) -> dict[str, str]:
        """Generate tutor speech for ``text``, routing to the voice's provider.

        ElevenLabs voices use the active TTS provider; legacy Gemini voices keep
        playing through Gemini so old conversations sound the same. TTS is
        intentionally limited to the Speaking Coach (it is a billed call).
        Returns ``{"audio": base64, "mime_type": str}``.
        """
        text = (text or "").strip()
        if not text:
            raise ValueError("text is required for speech synthesis")
        if voice not in TTS_VOICES:
            voice = DEFAULT_TTS_VOICE

        if is_elevenlabs_voice(voice):
            provider = self._tts
            if provider is None or not hasattr(provider, "generate_speech"):
                raise AiProviderError("ElevenLabs TTS is not configured")
        else:
            provider = self._audio_ai
            if not hasattr(provider, "generate_speech"):
                raise AiProviderError("The configured AI provider does not support speech synthesis")
        # ``generate_speech`` is provider-specific (not on the text AiTextPort), so
        # resolve it dynamically after the capability check above.
        synth = provider.generate_speech
        return synth(text, voice)

    def explain_phrase(self, text: str, context: str = "") -> dict[str, Any]:
        text = (text or "").strip()
        if not text:
            raise ValueError("text is required to explain a phrase")
        user_prompt = (
            f'Selected English word or phrase: "{text}"\n'
            f'Conversation context: "{context}"\n'
            "Provide: 'meaning' (a clear, friendly explanation in this context), "
            "'ipaExplanation' (syllable/stress/sound breakdown), and 'mouthTip' "
            "(physical tongue/lip placement to say it correctly)."
        )
        raw = self._ai.generate_json(_EXPLAIN_SYSTEM, user_prompt, _EXPLAIN_SCHEMA)
        return {
            "meaning": _str(raw.get("meaning")),
            "ipaExplanation": _str(raw.get("ipaExplanation")),
            "mouthTip": _str(raw.get("mouthTip")),
        }

    @staticmethod
    def _normalize_conversation(raw: dict[str, Any], fallback_topic: str) -> dict[str, Any]:
        lines = []
        for i, item in enumerate(raw.get("lines") or []):
            if not isinstance(item, dict):
                continue
            text = _str(item.get("text"))
            if not text:
                continue
            lines.append(
                {
                    "id": _str(item.get("id")) or f"l{i + 1}",
                    "speaker": _str(item.get("speaker")),
                    "text": text,
                }
            )
        return {
            "topic": _str(raw.get("topic")) or (fallback_topic or "Conversation"),
            "context": _str(raw.get("context")),
            "lines": lines,
        }

    @staticmethod
    def _normalize_analysis(raw: dict[str, Any]) -> dict[str, Any]:
        words = []
        for item in raw.get("wordAnalysis") or []:
            if not isinstance(item, dict):
                continue
            word = _str(item.get("word"))
            if not word:
                continue
            words.append(
                {
                    "word": word,
                    "status": _str(item.get("status")) or "correct",
                    "userPronunciation": _str(item.get("userPronunciation")),
                    "correctPronunciation": _str(item.get("correctPronunciation")),
                    "ipaTarget": _str(item.get("ipaTarget")),
                    "ipaSpoken": _str(item.get("ipaSpoken")),
                    "mouthTip": _str(item.get("mouthTip")),
                    "syllableStress": _str(item.get("syllableStress")),
                    "feedback": _str(item.get("feedback")),
                }
            )
        struggles = []
        for item in raw.get("keyStruggles") or []:
            if not isinstance(item, dict):
                continue
            sound = _str(item.get("sound"))
            if not sound:
                continue
            struggles.append(
                {
                    "sound": sound,
                    "description": _str(item.get("description")),
                    "tip": _str(item.get("tip")),
                }
            )
        return {
            "transcription": _str(raw.get("transcription")),
            "accuracyScore": _int(raw.get("accuracyScore")),
            "fluencyScore": _int(raw.get("fluencyScore")),
            "completenessScore": _int(raw.get("completenessScore")),
            "rhythmScore": _int(raw.get("rhythmScore")),
            "wordsPerMinute": _int(raw.get("wordsPerMinute")),
            "accentAnalysis": _str(raw.get("accentAnalysis")),
            "overallFeedback": _str(raw.get("overallFeedback")),
            "keyStruggles": struggles,
            "wordAnalysis": words,
        }


def _str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _int(value: Any) -> int:
    if value is None:
        return 0
    try:
        return max(0, min(int(round(float(value))), 100000))
    except (TypeError, ValueError):
        return 0

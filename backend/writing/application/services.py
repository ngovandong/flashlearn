"""Writing Coach application service.

All AI prompts, rules and JSON schemas for the Writing Coach live here so the
frontend stays a pure UI layer. It is provider-agnostic and depends only on
:class:`AiTextPort` (text/JSON generation); the concrete provider is injected
from the composition root.

Two modes are supported:

* **chat** — a conversational tutor that talks about a topic and, after every
  learner turn, returns correction feedback for that turn.
* **freeform** — a single submitted draft scored against the IELTS Writing band
  descriptors with inline corrections.
"""

import logging
import uuid
from typing import Any

from backend.shared.infrastructure.ai import default_ai_provider

logger = logging.getLogger(__name__)

LEVEL_LABELS = {
    "A1": "A1 (beginner)",
    "A2": "A2 (elementary)",
    "B1": "B1 (intermediate)",
    "B2": "B2 (upper-intermediate)",
    "C1": "C1 (advanced)",
    "C2": "C2 (proficient)",
}

_DEFAULT_FALLBACK_TOPICS = [
    "My Daily Routine",
    "A Memorable Holiday",
    "The Benefits of Regular Exercise",
    "The Pros and Cons of Remote Work",
    "The Role of Technology in Education",
]

# ─── JSON schemas (Gemini uppercase OpenAPI types) ───────────────────────────
_TOPICS_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {"topics": {"type": "ARRAY", "items": {"type": "STRING"}}},
    "required": ["topics"],
}

_CHAT_REPLY_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {"reply": {"type": "STRING"}},
    "required": ["reply"],
}

_MISTAKE_ITEM: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "text": {"type": "STRING"},
        "issue": {"type": "STRING"},
        "correction": {"type": "STRING"},
    },
    "required": ["text", "correction"],
}

_MESSAGE_FEEDBACK_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "hasIssues": {"type": "BOOLEAN"},
        "mistakes": {"type": "ARRAY", "items": _MISTAKE_ITEM},
        "correctedText": {"type": "STRING"},
        "betterVersion": {"type": "STRING"},
        "tips": {"type": "ARRAY", "items": {"type": "STRING"}},
        "examples": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["correctedText"],
}

_SUPPORT_TERM_ITEM: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "text": {"type": "STRING"},
        "note": {"type": "STRING"},
    },
    "required": ["text"],
}

_WRITING_SUPPORT_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "words": {"type": "ARRAY", "items": _SUPPORT_TERM_ITEM},
        "phrases": {"type": "ARRAY", "items": _SUPPORT_TERM_ITEM},
        "grammar": {"type": "ARRAY", "items": {"type": "STRING"}},
        "structure": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["words", "phrases"],
}

_CORRECTION_ITEM: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "text": {"type": "STRING"},
        "type": {"type": "STRING", "enum": ["grammar", "spelling", "vocabulary", "style", "punctuation"]},
        "issue": {"type": "STRING"},
        "suggestion": {"type": "STRING"},
    },
    "required": ["text", "suggestion"],
}

_BANDS_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "taskResponse": {"type": "NUMBER"},
        "coherence": {"type": "NUMBER"},
        "lexical": {"type": "NUMBER"},
        "grammar": {"type": "NUMBER"},
    },
    "required": ["taskResponse", "coherence", "lexical", "grammar"],
}

_DRAFT_FEEDBACK_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "corrections": {"type": "ARRAY", "items": _CORRECTION_ITEM},
        "bands": _BANDS_SCHEMA,
        "overallBand": {"type": "NUMBER"},
        "summary": {"type": "STRING"},
        "strengths": {"type": "ARRAY", "items": {"type": "STRING"}},
        "improvements": {"type": "ARRAY", "items": {"type": "STRING"}},
        "improvedVersion": {"type": "STRING"},
    },
    "required": ["bands", "overallBand", "summary"],
}

_EXPLAIN_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "meaning": {"type": "STRING"},
        "examples": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["meaning"],
}

# ─── System prompts ──────────────────────────────────────────────────────────
_CHAT_SYSTEM = (
    "You are 'Dragon', a warm, encouraging English writing tutor in a flashcard study app. "
    "You hold a natural written conversation with a learner about a topic to help them practice "
    "writing in English. Keep your replies short (1-3 sentences), stay on the topic, react to what "
    "the learner wrote, and always end with a follow-up question that invites them to write more. "
    "Always answer with a single JSON object matching the requested schema."
)

_FEEDBACK_SYSTEM = (
    "You are an English writing tutor giving feedback on one message a learner wrote in a chat. "
    "Be encouraging and concise. Always answer with a single JSON object matching the requested schema."
)

_SUPPORT_SYSTEM = (
    "You help an English learner prepare to write about a topic. You suggest useful vocabulary, "
    "phrases, grammar structures and an essay/paragraph structure. Always answer with a single JSON "
    "object matching the requested schema."
)

_DRAFT_SYSTEM = (
    "You are a certified IELTS Writing examiner and English tutor. You assess a learner's writing "
    "against the four IELTS Writing band descriptors and give actionable, encouraging feedback. "
    "Always answer with a single JSON object matching the requested schema."
)

_EXPLAIN_SYSTEM = (
    "You are a friendly English writing tutor. Explain a selected word or phrase for a language "
    "learner in the context it appeared. Always answer with a single JSON object matching the schema."
)


class WritingCoachService:
    """AI operations for the Writing Coach feature.

    Depends only on a text/JSON-capable provider (:class:`AiTextPort`); the
    concrete provider is injected from the composition root.
    """

    def __init__(self, ai: Any = default_ai_provider):
        self._ai = ai

    # ── Topics ────────────────────────────────────────────────────────────
    def suggest_topics(self, history: list[str] | None = None) -> list[str]:
        recent = ", ".join((history or [])[-5:])
        user_prompt = (
            "Suggest 5 English writing practice topics suitable for essays or written discussion, "
            f'each 2-7 words. Avoid these recent ones: [{recent}]. Return JSON {{"topics": []}}.'
        )
        try:
            raw = self._ai.generate_json(
                "You suggest concise English writing practice topics as JSON.",
                user_prompt,
                _TOPICS_SCHEMA,
            )
        except Exception:
            logger.exception("Failed to suggest writing topics")
            return list(_DEFAULT_FALLBACK_TOPICS)
        topics = [t.strip() for t in (raw.get("topics") or []) if isinstance(t, str) and t.strip()]
        return topics[:5] or list(_DEFAULT_FALLBACK_TOPICS)

    # ── Chat mode ─────────────────────────────────────────────────────────
    def chat_reply(
        self,
        *,
        topic: str,
        level: str | None = None,
        tone: str | None = None,
        history: list[dict[str, Any]] | None = None,
    ) -> str:
        """The tutor's next conversational turn given the running ``history``."""
        level_rule = (
            f"Match your vocabulary and sentence complexity to CEFR level {LEVEL_LABELS.get(level, level)}."
            if level
            else ""
        )
        tone_rule = f"Keep a {tone} tone." if tone else ""
        transcript = self._format_history(history)
        if transcript:
            user_prompt = (
                f'You are chatting about the topic "{topic or "a topic of your choice"}".\n'
                f"{level_rule} {tone_rule}\n"
                "Conversation so far:\n"
                f"{transcript}\n"
                "Write Dragon's next reply: react to the learner's last message and ask one follow-up question."
            )
        else:
            user_prompt = (
                f'Start a friendly written conversation about "{topic or "a topic of your choice"}".\n'
                f"{level_rule} {tone_rule}\n"
                "Greet the learner warmly, introduce the topic in one sentence and ask an opening question."
            )
        raw = self._ai.generate_json(_CHAT_SYSTEM, user_prompt, _CHAT_REPLY_SCHEMA)
        return _str(raw.get("reply")) or "Let's keep going — tell me more about that!"

    def analyze_message(self, text: str, *, topic: str = "", context: str = "") -> dict[str, Any]:
        """Correction feedback for one learner chat message."""
        text = (text or "").strip()
        if not text:
            raise ValueError("text is required to analyze a message")
        user_prompt = (
            f'Topic: "{topic}". The tutor just said: "{context}".\n'
            f'The learner wrote: "{text}"\n'
            "Review the learner's message. Provide:\n"
            "- 'hasIssues': true if there are any mistakes, false if it is already correct.\n"
            "- 'mistakes': each error as {text (the exact wrong fragment), issue (what is wrong), "
            "correction (the fixed fragment)}. Empty if none.\n"
            "- 'correctedText': the learner's message rewritten correctly (keep their meaning).\n"
            "- 'betterVersion': a more natural, higher-level way to express the same idea.\n"
            "- 'tips': up to 3 short writing tips.\n"
            "- 'examples': up to 2 example sentences using the corrected language."
        )
        raw = self._ai.generate_json(_FEEDBACK_SYSTEM, user_prompt, _MESSAGE_FEEDBACK_SCHEMA)
        return self._normalize_message_feedback(raw, text)

    # ── Free-form support + assessment ────────────────────────────────────
    def writing_support(self, topic: str, level: str | None = None) -> dict[str, Any]:
        """Vocabulary, phrases, grammar and structure hints for a free-form topic."""
        level_rule = f"Target CEFR level {LEVEL_LABELS.get(level, level)}." if level else ""
        user_prompt = (
            f'A learner is about to write about: "{topic or "a topic of their choice"}".\n'
            f"{level_rule}\n"
            "Suggest helpful material to write a strong piece:\n"
            "- 'words': 5-8 useful topic words, each {text, note (short meaning/usage)}.\n"
            "- 'phrases': 4-6 useful phrases or collocations, each {text, note}.\n"
            "- 'grammar': 2-4 grammar structures to try (short strings).\n"
            "- 'structure': 3-5 short bullet points outlining how to organise the writing."
        )
        raw = self._ai.generate_json(_SUPPORT_SYSTEM, user_prompt, _WRITING_SUPPORT_SCHEMA)
        return self._normalize_support(raw)

    def analyze_draft(self, *, topic: str, draft: str, level: str | None = None) -> dict[str, Any]:
        """Assess a submitted draft against IELTS Writing bands with corrections."""
        draft = (draft or "").strip()
        if not draft:
            raise ValueError("draft is required for assessment")
        level_rule = f"The learner is aiming for CEFR level {LEVEL_LABELS.get(level, level)}." if level else ""
        user_prompt = (
            f'Topic / prompt: "{topic}".\n{level_rule}\n'
            f'The learner wrote:\n"""\n{draft}\n"""\n'
            "Assess it as an IELTS examiner and provide:\n"
            "- 'corrections': each issue as {text (the exact fragment from the writing), type "
            "(grammar|spelling|vocabulary|style|punctuation), issue (what is wrong), suggestion (the fix)}. "
            "Use the EXACT substring from the writing for 'text' so it can be highlighted.\n"
            "- 'bands': IELTS band scores 0-9 (allow .5) for taskResponse, coherence (coherence & cohesion), "
            "lexical (lexical resource), grammar (grammatical range & accuracy).\n"
            "- 'overallBand': the overall IELTS band 0-9 (.5 allowed), the average rounded to the nearest 0.5.\n"
            "- 'summary': 2-3 encouraging sentences on the overall quality.\n"
            "- 'strengths': up to 3 strengths.\n"
            "- 'improvements': up to 3 concrete things to improve.\n"
            "- 'improvedVersion': a model rewrite at a higher band."
        )
        raw = self._ai.generate_json(_DRAFT_SYSTEM, user_prompt, _DRAFT_FEEDBACK_SCHEMA)
        return self._normalize_draft_feedback(raw)

    # ── Highlight explanation ─────────────────────────────────────────────
    def explain_phrase(self, text: str, context: str = "") -> dict[str, Any]:
        text = (text or "").strip()
        if not text:
            raise ValueError("text is required to explain a phrase")
        user_prompt = (
            f'Selected English word or phrase: "{text}"\n'
            f'Context it appeared in: "{context}"\n'
            "Provide: 'meaning' (a clear, friendly explanation in this context) and "
            "'examples' (1-2 example sentences using it)."
        )
        raw = self._ai.generate_json(_EXPLAIN_SYSTEM, user_prompt, _EXPLAIN_SCHEMA)
        return {
            "meaning": _str(raw.get("meaning")),
            "examples": [e.strip() for e in (raw.get("examples") or []) if isinstance(e, str) and e.strip()],
        }

    # ── Normalizers ───────────────────────────────────────────────────────
    @staticmethod
    def _format_history(history: list[dict[str, Any]] | None) -> str:
        lines = []
        for item in history or []:
            if not isinstance(item, dict):
                continue
            text = _str(item.get("text"))
            if not text:
                continue
            speaker = "Learner" if item.get("role") == "user" else "Dragon"
            lines.append(f"{speaker}: {text}")
        return "\n".join(lines)

    @staticmethod
    def _normalize_message_feedback(raw: dict[str, Any], original: str) -> dict[str, Any]:
        mistakes = []
        for item in raw.get("mistakes") or []:
            if not isinstance(item, dict):
                continue
            fragment = _str(item.get("text"))
            correction = _str(item.get("correction"))
            if not fragment and not correction:
                continue
            mistakes.append({"text": fragment, "issue": _str(item.get("issue")), "correction": correction})
        corrected = _str(raw.get("correctedText")) or original
        return {
            "hasIssues": bool(raw.get("hasIssues")) or bool(mistakes),
            "mistakes": mistakes,
            "correctedText": corrected,
            "betterVersion": _str(raw.get("betterVersion")),
            "tips": [t.strip() for t in (raw.get("tips") or []) if isinstance(t, str) and t.strip()],
            "examples": [e.strip() for e in (raw.get("examples") or []) if isinstance(e, str) and e.strip()],
        }

    @staticmethod
    def _normalize_support(raw: dict[str, Any]) -> dict[str, Any]:
        def _terms(key):
            out = []
            for item in raw.get(key) or []:
                if not isinstance(item, dict):
                    continue
                text = _str(item.get("text"))
                if text:
                    out.append({"text": text, "note": _str(item.get("note"))})
            return out

        def _strings(key):
            return [s.strip() for s in (raw.get(key) or []) if isinstance(s, str) and s.strip()]

        return {
            "words": _terms("words"),
            "phrases": _terms("phrases"),
            "grammar": _strings("grammar"),
            "structure": _strings("structure"),
        }

    @classmethod
    def _normalize_draft_feedback(cls, raw: dict[str, Any]) -> dict[str, Any]:
        corrections = []
        for item in raw.get("corrections") or []:
            if not isinstance(item, dict):
                continue
            fragment = _str(item.get("text"))
            suggestion = _str(item.get("suggestion"))
            if not fragment and not suggestion:
                continue
            corrections.append(
                {
                    "text": fragment,
                    "type": _str(item.get("type")) or "style",
                    "issue": _str(item.get("issue")),
                    "suggestion": suggestion,
                }
            )
        bands_raw = raw.get("bands") if isinstance(raw.get("bands"), dict) else {}
        bands = {
            "taskResponse": _band(bands_raw.get("taskResponse")),
            "coherence": _band(bands_raw.get("coherence")),
            "lexical": _band(bands_raw.get("lexical")),
            "grammar": _band(bands_raw.get("grammar")),
        }
        return {
            "corrections": corrections,
            "bands": bands,
            "overallBand": _band(raw.get("overallBand")),
            "summary": _str(raw.get("summary")),
            "strengths": [s.strip() for s in (raw.get("strengths") or []) if isinstance(s, str) and s.strip()],
            "improvements": [s.strip() for s in (raw.get("improvements") or []) if isinstance(s, str) and s.strip()],
            "improvedVersion": _str(raw.get("improvedVersion")),
        }


def _str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _band(value: Any) -> float:
    """Clamp a score to the IELTS 0-9 range, rounded to the nearest 0.5."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    number = max(0.0, min(number, 9.0))
    return round(number * 2) / 2


def new_message_id() -> str:
    return f"m{uuid.uuid4().hex[:10]}"

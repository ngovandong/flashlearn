"""Dragon Assistant application service.

The free-form chat brain behind the floating "Dragon" buddy. Unlike the focused
coaches (Writing / Grammar / Speaking), this is a general English-learning
assistant that ALSO knows the FlashLearn app, so it can answer a learner's
question *and* point them at the right feature.

It is provider-agnostic — it depends only on :class:`AiTextPort` (text/JSON
generation); the concrete provider is injected from the composition root. The
chat is stateless: the client sends a short rolling ``history`` with every turn,
so there is no session model to persist.

Safety: the model may only *suggest* navigation. Every returned action is
validated against a whitelist of real static routes and known tour ids here, so
a hallucinated or destructive target is dropped rather than shown to the user.
"""

import logging
from typing import Any

from backend.shared.infrastructure.ai import default_ai_provider

logger = logging.getLogger(__name__)

# ─── What Dragon can send the learner to ─────────────────────────────────────
# Static, non-destructive destinations only. The assistant never knows a
# concrete deck/course id, so dynamic routes are deliberately excluded; it sends
# people to the relevant hub and lets them pick.
_ROUTES: dict[str, str] = {
    "/": "Home — dashboard with your decks, courses and next-step reminders.",
    "/deck": "Browse & clone public community decks.",
    "/create-deck": "Create a brand-new flashcard deck.",
    "/course": "Guided, level-based courses (speaking, listening and grammar).",
    "/listening": "Listening tests — hear a clip and type what you hear (dictation).",
    "/listening/numbers": "Number listening drill — type the English numbers you hear.",
    "/speaking-coach": "Speaking practice — AI dialogues read aloud with pronunciation scoring.",
    "/writing-coach": "Writing practice — chat feedback or an IELTS-style band score.",
    "/grammar": "Grammar lessons (Grammar in Use) with auto-graded exercises.",
    "/revise": "A quick mixed review round focused on the mistakes you made before.",
    "/settings": "Account settings — theme, dark mode, notifications and profile.",
}

# Onboarding tours Dragon may launch ("show me how this page works"). Keep in
# sync with frontend/apps/web/src/constants/tours.js.
_TOURS: set[str] = {
    "home",
    "deck-detail",
    "deck-learn",
    "deck-revise",
    "deck-quick-revise",
    "deck-edit",
    "listening",
    "listen-and-type",
    "number-test",
    "course",
    "speaking-coach",
    "writing-coach",
    "grammar",
    "revise",
    "settings",
    "create-deck",
}

_MAX_ACTIONS = 3
_MAX_SUGGESTIONS = 3
_MAX_HISTORY_TURNS = 10

_ACTION_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "type": {"type": "STRING", "enum": ["navigate", "tour"]},
        "label": {"type": "STRING"},
        "route": {"type": "STRING"},
        "tour_id": {"type": "STRING"},
    },
    "required": ["type", "label"],
}

_CHAT_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "reply": {"type": "STRING"},
        "actions": {"type": "ARRAY", "items": _ACTION_SCHEMA},
        "suggestions": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["reply"],
}

_FEATURE_MAP = "\n".join(f"  - {route} → {desc}" for route, desc in _ROUTES.items())

_SYSTEM = (
    "You are 'Dragon', the warm, upbeat English-learning buddy inside FlashLearn, a flashcard study "
    "app. You have two jobs, and you do both in one reply:\n"
    "1) TUTOR: answer the learner's English question directly and helpfully — word meanings, grammar, "
    "example sentences, pronunciation (give IPA when useful), natural phrasing, correcting their "
    "mistakes, and translating between English and Vietnamese when asked. Be accurate and concrete.\n"
    "2) GUIDE: when a practice tool fits what they want, recommend it and offer an action button to it.\n\n"
    "FlashLearn features you can send the learner to (use the EXACT route string):\n"
    f"{_FEATURE_MAP}\n\n"
    "STYLE: friendly and encouraging, like a favourite teacher. Keep 'reply' short and scannable "
    "(usually 1-4 short sentences or a few '-' bullet lines); use plain text, not tables. A learner may "
    "be a beginner, so keep language simple unless they show a higher level.\n\n"
    "ACTIONS (optional, at most 3): only include an action when it genuinely helps.\n"
    "  - {type:'navigate', label:'<short button text>', route:'<one EXACT route above>'} to open a page.\n"
    "  - {type:'tour', label:'<short button text>', tour_id:'<tour id>'} to run a page's how-to guide.\n"
    "  Never invent a route or tour id. If none fits, return no actions.\n"
    "SUGGESTIONS (optional, at most 3): short tappable follow-up prompts the learner might ask next, "
    "each written in the learner's voice (e.g. 'Give me 3 example sentences').\n\n"
    "Always answer with a single JSON object matching the requested schema."
)


class AssistantService:
    """The conversational brain for the Dragon floating assistant.

    Stateless: every call receives the recent ``history`` from the client.
    Depends only on a text/JSON-capable provider (:class:`AiTextPort`).
    """

    def __init__(self, ai: Any = default_ai_provider):
        self._ai = ai

    def chat(
        self,
        *,
        message: str,
        history: list[dict[str, Any]] | None = None,
        page: str = "",
    ) -> dict[str, Any]:
        """Dragon's reply to one learner message.

        ``history`` is the recent transcript (``[{role, text}, ...]``); ``page``
        is the route the learner is currently on, used for context. Returns
        ``{"reply", "actions", "suggestions"}`` with every action validated
        against the route/tour whitelist.
        """
        message = (message or "").strip()
        if not message:
            raise ValueError("message is required")

        transcript = self._format_history(history)
        context = f"The learner is currently on the page: {page}.\n" if page else ""
        user_prompt = (
            f"{context}"
            + (f"Conversation so far:\n{transcript}\n\n" if transcript else "")
            + f"The learner now says:\n{message}\n\n"
            "Write Dragon's next reply. Answer their question first, then add an action only if a "
            "FlashLearn feature genuinely helps."
        )
        raw = self._ai.generate_json(_SYSTEM, user_prompt, _CHAT_SCHEMA) or {}
        return {
            "reply": _str(raw.get("reply")) or "I'm here to help! Could you tell me a bit more?",
            "actions": self._clean_actions(raw.get("actions")),
            "suggestions": _strings(raw.get("suggestions"))[:_MAX_SUGGESTIONS],
        }

    @staticmethod
    def _clean_actions(raw: Any) -> list[dict[str, str]]:
        """Keep only whitelisted, well-formed actions (drop hallucinations)."""
        out: list[dict[str, str]] = []
        for item in raw or []:
            if not isinstance(item, dict) or len(out) >= _MAX_ACTIONS:
                continue
            kind = _str(item.get("type"))
            label = _str(item.get("label"))
            if not label:
                continue
            if kind == "navigate":
                route = _str(item.get("route"))
                if route in _ROUTES:
                    out.append({"type": "navigate", "label": label, "route": route})
            elif kind == "tour":
                tour_id = _str(item.get("tour_id"))
                if tour_id in _TOURS:
                    out.append({"type": "tour", "label": label, "tour_id": tour_id})
        return out

    @staticmethod
    def _format_history(history: list[dict[str, Any]] | None) -> str:
        lines = []
        for item in (history or [])[-_MAX_HISTORY_TURNS:]:
            if not isinstance(item, dict):
                continue
            text = _str(item.get("text"))
            if not text:
                continue
            speaker = "Learner" if item.get("role") == "user" else "Dragon"
            lines.append(f"{speaker}: {text}")
        return "\n".join(lines)


def _str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _strings(value: Any) -> list[str]:
    return [s.strip() for s in (value or []) if isinstance(s, str) and s.strip()]

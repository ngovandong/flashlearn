"""Writing Coach orchestration service.

Coordinates the AI coach (:class:`WritingCoachService`), the response cache and
persistence (:class:`WritingRepository`) for every Writing Coach use case. The
DRF viewset is a thin transport layer that only parses requests, serializes
results and maps exceptions — all rules and data access live here.
"""

import logging
import re
from typing import Any

from backend.models import WritingSession
from backend.writing import topics as writing_topics
from backend.writing.application.services import WritingCoachService, new_message_id
from backend.writing.infrastructure.repository import WritingRepository

logger = logging.getLogger(__name__)


class WritingService:
    def __init__(
        self,
        coach: WritingCoachService,
        repo: type[WritingRepository] | WritingRepository = WritingRepository,
    ):
        self._coach = coach
        self._repo = repo

    # ── Topics ────────────────────────────────────────────────────────────
    def suggest_topics(self, history: list[str] | None = None, level: str | None = None) -> list[str]:
        topics = writing_topics.random_for_level(level=level, exclude=history or [], limit=5)
        # Fall back to the AI suggester only if the topics file is empty/missing.
        if not topics:
            topics = self._coach.suggest_topics(history or [])
        return topics

    # ── Chat mode ─────────────────────────────────────────────────────────
    def start_chat(self, user, *, topic: str = "", level: str | None = None, tone: str | None = None):
        reply = self._coach.chat_reply(topic=topic, level=level, tone=tone, history=[])
        opening = {"id": new_message_id(), "role": "assistant", "text": reply}
        return self._repo.create_session(
            user=user,
            mode=WritingSession.MODE_CHAT,
            topic=topic or "",
            level=level or "",
            tone=tone or "",
            messages=[opening],
        )

    def chat_message(self, user, session_id: str, text: str):
        """Append the learner's message (with feedback) plus the tutor's reply."""
        session = self._repo.get_session(user, session_id)
        if session is None:
            return None
        text = (text or "").strip()
        if not text:
            return session

        messages = list(session.messages or [])
        last_assistant = next(
            (m.get("text", "") for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "assistant"),
            "",
        )
        feedback = self._coach.analyze_message(text, topic=session.topic, context=last_assistant)
        messages.append({"id": new_message_id(), "role": "user", "text": text, "feedback": feedback})

        reply = self._coach.chat_reply(topic=session.topic, level=session.level, tone=session.tone, history=messages)
        messages.append({"id": new_message_id(), "role": "assistant", "text": reply})

        session.messages = messages
        self._repo.save_session(session, ["messages", "updated_at"])
        return session

    # ── Free-form mode ────────────────────────────────────────────────────
    def writing_support(self, topic: str, level: str | None = None) -> dict[str, Any]:
        # The same topic/level yields the same guidance, so cache it.
        return self._repo.remember_response(
            "writing_support",
            [(topic or "").strip().lower(), (level or "").strip()],
            lambda: self._coach.writing_support(topic, level),
        )

    def submit_draft(
        self, user, *, topic: str = "", draft: str = "", level: str | None = None, tone: str | None = None
    ):
        feedback = self._coach.analyze_draft(topic=topic, draft=draft, level=level)
        return self._repo.create_session(
            user=user,
            mode=WritingSession.MODE_FREEFORM,
            topic=topic or "",
            level=level or "",
            tone=tone or "",
            draft=draft,
            feedback=feedback,
        )

    # ── Highlight explanation ─────────────────────────────────────────────
    def explain_phrase(self, text: str, context: str = "") -> dict[str, Any]:
        return self._repo.remember_response(
            "writing_explain",
            [text.lower(), (context or "").strip()],
            lambda: self._coach.explain_phrase(text, context),
        )

    # ── History ───────────────────────────────────────────────────────────
    def history(self, user):
        return self._repo.recent_sessions(user)

    def get_session(self, user, session_id):
        return self._repo.get_session(user, session_id)

    def delete_sessions(self, user, ids):
        return self._repo.delete_sessions(user, ids)

    def set_star(self, session, starred: bool | None):
        session.starred = (not session.starred) if starred is None else bool(starred)
        self._repo.save_session(session, ["starred", "updated_at"])
        return session

    def update_highlight(self, session, *, text: str, note: str = "", remove: bool = False):
        highlights = [h for h in (session.highlights or []) if isinstance(h, dict) and h.get("text")]
        lowered = text.lower()
        existing = next((h for h in highlights if (h.get("text") or "").lower() == lowered), None)
        if remove:
            highlights = [h for h in highlights if (h.get("text") or "").lower() != lowered]
        elif existing is not None:
            existing["note"] = note
        else:
            highlights.append({"text": text, "note": note})

        session.highlights = highlights
        self._repo.save_session(session, ["highlights", "updated_at"])
        return highlights

    def match_terms(self, user, *, texts: list[str] | None = None, session_id: str | None = None):
        """The user's own terms that appear in a session's text.

        Accepts either an explicit ``texts`` list or a ``session_id`` whose chat
        messages / draft are matched. When the same word lives in several decks
        the first one encountered wins.
        """
        if session_id and not isinstance(texts, list):
            session = self._repo.get_session(user, session_id)
            texts = self._session_texts(session) if session else []
        if not isinstance(texts, list):
            texts = []

        full_text = "\n".join(t for t in texts if isinstance(t, str)).lower()
        if not full_text.strip():
            return []

        words = set(re.findall(r"[a-z']+", full_text))
        matches = []
        seen = set()
        for term in self._repo.owned_terms(user):
            name = (term["name"] or "").strip()
            lowered = name.lower()
            if not lowered or lowered in seen:
                continue
            tokens = lowered.split()
            found = (lowered in words) if len(tokens) == 1 else (lowered in full_text)
            if found:
                seen.add(lowered)
                matches.append({"term_id": str(term["id"]), "deck_id": str(term["deck_id"]), "name": name})
        return matches

    @staticmethod
    def _session_texts(session) -> list[str]:
        if session.mode == WritingSession.MODE_FREEFORM:
            return [session.draft or ""]
        return [m.get("text", "") for m in (session.messages or []) if isinstance(m, dict)]

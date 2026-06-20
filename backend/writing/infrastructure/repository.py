"""Persistence for the Writing Coach feature.

All Django ORM access for writing sessions and the shared AI response cache
lives here so the application service and the DRF viewset never touch the ORM
directly.
"""

from backend.models import AiResponseCache, Term, WritingSession


class WritingRepository:
    # ── Sessions ──────────────────────────────────────────────────────────
    @staticmethod
    def create_session(*, user, mode, topic, level, tone, messages=None, draft="", feedback=None):
        return WritingSession.objects.create(
            user=user,
            mode=mode,
            topic=topic,
            level=level,
            tone=tone,
            messages=messages or [],
            draft=draft,
            feedback=feedback or {},
        )

    @staticmethod
    def get_session(user, session_id):
        return WritingSession.objects.filter(id=session_id, user=user).first()

    @staticmethod
    def recent_sessions(user, limit=50):
        return WritingSession.objects.filter(user=user)[:limit]

    @staticmethod
    def save_session(session, fields):
        session.save(update_fields=fields)

    @staticmethod
    def delete_sessions(user, ids):
        deleted, _ = WritingSession.objects.filter(id__in=ids, user=user).delete()
        return deleted

    # ── AI response cache ─────────────────────────────────────────────────
    @staticmethod
    def remember_response(context, parts, producer):
        """Return the cached AI response for ``(context, parts)`` or compute it."""
        return AiResponseCache.remember(context, parts, producer)

    # ── Cross-aggregate reads (term matching) ─────────────────────────────
    @staticmethod
    def owned_terms(user):
        """``(id, name, deck_id)`` for every term in a deck the user owns."""
        return Term.objects.filter(deck__owner=user).values("id", "name", "deck_id")

"""Persistence for the home-page Reminders feature.

Reminders are *computed*, not stored — this repository gathers the small,
cross-aggregate reads (the latest conversation, the last-touched course, a
studyable deck) needed to decide which "pick up where you left off" prompts a
user can act on. All Django ORM access for the feature lives here so the
application service and the DRF viewset never touch the ORM directly.
"""

from django.db.models import Count, Q
from django.db.models.functions import Greatest

from backend.models import (
    Course,
    CourseLesson,
    Deck,
    GrammarUnit,
    SpeakingConversation,
    UserCourseLessonProgress,
    UserGrammarUnitProgress,
    UserLearningProgress,
    WritingSession,
)


class ReminderRepository:
    # ── Speaking ──────────────────────────────────────────────────────────
    @staticmethod
    def latest_conversation(user):
        """The user's most recently generated conversation, or ``None``."""
        return SpeakingConversation.objects.filter(user=user).order_by("-created_at").first()

    # ── Writing ───────────────────────────────────────────────────────────
    @staticmethod
    def latest_writing_session(user):
        """The user's most recently created writing session, or ``None``."""
        return WritingSession.objects.filter(user=user).order_by("-created_at").first()

    # ── Course ────────────────────────────────────────────────────────────
    @staticmethod
    def last_course_progress(user):
        """The user's most recently touched lesson progress, or ``None``."""
        return UserCourseLessonProgress.objects.filter(user=user).order_by("-updated_at").first()

    @staticmethod
    def course_for_lesson_key(lesson_key):
        """The :class:`Course` owning ``lesson_key``, or ``None`` if unknown.

        Progress is keyed on the lesson's stable string ``key`` (no FK), so the
        owning course is resolved by looking the lesson up by key.
        """
        lesson = CourseLesson.objects.filter(key=lesson_key).select_related("section__course").first()
        return lesson.section.course if lesson is not None else None

    @staticmethod
    def first_course():
        return Course.objects.order_by("order", "level", "title").first()

    @staticmethod
    def ordered_lessons(course):
        """``[{id, slug, key}, ...]`` for a course in section→lesson order."""
        return list(
            CourseLesson.objects.filter(section__course=course)
            .order_by("section__order", "order")
            .values("id", "slug", "key")
        )

    @staticmethod
    def passed_lesson_keys(user):
        """The set of lesson ``key``s the user has passed."""
        return set(
            UserCourseLessonProgress.objects.filter(
                user=user,
                status=UserCourseLessonProgress.STATUS_PASSED,
            ).values_list("lesson_key", flat=True)
        )

    # ── Grammar ───────────────────────────────────────────────────────────
    @staticmethod
    def latest_grammar_unit(user):
        """``{key, title, status}`` of the user's most recently touched grammar
        unit, or ``None``. Progress is keyed on the unit's stable ``unit_key``,
        so the title is resolved by looking the unit up by key."""
        progress = UserGrammarUnitProgress.objects.filter(user=user).order_by("-updated_at").first()
        if progress is None:
            return None
        unit = GrammarUnit.objects.filter(key=progress.unit_key).first()
        if unit is None:
            return None
        return {"key": unit.key, "title": unit.title, "status": progress.status}

    # ── Decks ─────────────────────────────────────────────────────────────
    @staticmethod
    def last_studied_deck_id(user):
        """Deck id of the user's most recent learn/revise activity, or ``None``."""
        return (
            UserLearningProgress.objects.filter(user=user)
            .annotate(last_at=Greatest("last_revised_at", "last_learned_at"))
            .order_by("-last_at")
            .values_list("term__deck_id", flat=True)
            .first()
        )

    @staticmethod
    def deck_with_terms(user, min_terms, prefer_deck_id=None):
        """A deck the user can study with at least ``min_terms`` terms.

        Prefers ``prefer_deck_id`` (the last-studied deck) when it qualifies,
        otherwise the most recently updated qualifying deck. Returns ``None``
        when the user has no deck big enough.
        """
        base = (
            Deck.objects.filter(Q(owner=user) | Q(users=user))
            .annotate(number_of_term=Count("terms", distinct=True))
            .filter(number_of_term__gte=min_terms)
        )
        if prefer_deck_id:
            preferred = base.filter(id=prefer_deck_id).first()
            if preferred is not None:
                return preferred
        return base.order_by("-updated_at").first()

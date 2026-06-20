"""Reminders orchestration service.

Builds the home-page "pick up where you left off" prompts. Every reminder is
checked for availability before it is offered (a *revise conversation* needs at
least one saved conversation, a *learn* deck at least one term, a *revise* deck
at least four), then the list is shuffled and capped so the home page shows a
fresh, random handful each visit. The DRF viewset stays a thin transport layer.
"""

import random

from backend.reminders.infrastructure.repository import ReminderRepository

# Most reminders a single home-page render shows.
MAX_REMINDERS = 4
# A revise round needs enough terms to build distractor options.
REVISE_MIN_TERMS = 4


class ReminderService:
    def __init__(self, *, repo=ReminderRepository):
        self._repo = repo

    def for_user(self, user):
        """A shuffled list (≤ :data:`MAX_REMINDERS`) of actionable reminders.

        Each item is ``{"type", "route", "label"}`` where ``label`` is the
        dynamic context (deck/course/conversation name) the frontend interpolates
        into its copy, or ``None`` for context-free reminders.
        """
        reminders = [
            {"type": "speaking_new", "route": "/speaking-coach", "label": None},
            {"type": "listening", "route": "/number-test", "label": None},
        ]

        conversation = self._repo.latest_conversation(user)
        if conversation is not None:
            reminders.append(
                {
                    "type": "speaking_revise",
                    "route": f"/speaking-coach/{conversation.id}",
                    "label": conversation.topic or "your last conversation",
                }
            )

        course_target = self._next_course_lesson(user)
        if course_target is not None:
            course, lesson_id = course_target
            reminders.append(
                {
                    "type": "course",
                    "route": f"/speaking-coach/course/{course.slug}/{lesson_id}",
                    "label": course.title,
                }
            )

        last_deck_id = self._repo.last_studied_deck_id(user)
        learn_deck = self._repo.deck_with_terms(user, 1, prefer_deck_id=last_deck_id)
        if learn_deck is not None:
            reminders.append({"type": "learn", "route": f"/deck/{learn_deck.id}/learn", "label": learn_deck.name})

        revise_deck = self._repo.deck_with_terms(user, REVISE_MIN_TERMS, prefer_deck_id=last_deck_id)
        if revise_deck is not None:
            reminders.append({"type": "revise", "route": f"/deck/{revise_deck.id}/revise", "label": revise_deck.name})

        random.shuffle(reminders)
        return reminders[:MAX_REMINDERS]

    # ── Internals ─────────────────────────────────────────────────────────
    def _next_course_lesson(self, user):
        """``(course, lesson_id)`` for the next lesson to study, or ``None``.

        Picks the user's last-progressed course (else the first course) and its
        first not-yet-passed lesson; if every lesson is passed, the first lesson
        is offered again for review.
        """
        progress = self._repo.last_course_progress(user)
        course = None
        if progress is not None:
            course = self._repo.course_for_lesson_key(progress.lesson_key)
        if course is None:
            course = self._repo.first_course()
        if course is None:
            return None

        lessons = self._repo.ordered_lessons(course)
        if not lessons:
            return None

        passed = self._repo.passed_lesson_keys(user)
        for lesson in lessons:
            if lesson["key"] not in passed:
                return course, lesson["id"]
        return course, lessons[0]["id"]

from datetime import timedelta
from typing import Any

from django.utils import timezone

from backend.learning.infrastructure.cache import learning_progress_cache
from backend.learning.infrastructure.repository import LearningRepository
from backend.models import User
from backend.shared.application.exceptions import NotFoundError


class LearningService:
    def __init__(
        self,
        learning_repo: type[LearningRepository] | LearningRepository = LearningRepository,
        term_context: Any = None,
        user_context: Any = None,
        learning_cache: Any = learning_progress_cache,
    ):
        self._learning_repo = learning_repo
        self._term_context = term_context
        self._user_context = user_context
        self._learning_cache = learning_cache

    def get_learning_progress(self, deck_id, user):
        progress = self._learning_cache.get_combine(deck_id, user.id)
        if progress:
            return progress

        today = timezone.localtime(timezone.now()).date()
        progress = self._learning_repo.get_learning_progress_stats(user.id, deck_id, today)
        self._learning_cache.set_combine(deck_id, user.id, progress)
        return progress

    def record_study_activity(self, user: User, cache=None) -> None:
        today = timezone.localdate()
        if user.last_study_date == today:
            return

        yesterday = today - timedelta(days=1)
        if user.last_study_date == yesterday:
            user.learning_streak_count += 1
        else:
            user.learning_streak_count = 1

        user.last_study_date = today
        user.save(update_fields=["learning_streak_count", "last_study_date"])
        if self._user_context:
            self._user_context.clear_cache(user.id, cache)

    def get_learning_streak(self, user: User) -> dict:
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        last = user.last_study_date
        studied_today = last == today

        if last == today or last == yesterday:
            streak = user.learning_streak_count
        else:
            streak = 0

        return {"streak": streak, "studied_today": studied_today}

    def clear_learning_progress(self, deck_id, user):
        self._learning_repo.clear_for_deck(deck_id, user)
        self._learning_cache.delete_combine(deck_id, user.id)

    def create_or_touch_progress(self, user, term_id, user_id):
        if self._term_context is None:
            raise RuntimeError("term_context is not configured")
        term = self._term_context.get_by_id(term_id)
        if term is None:
            raise NotFoundError("term not found")
        deck_id = term.deck_id
        instance = self._learning_repo.get_by_user_and_term(user, term_id)
        if instance is None:
            instance = self._learning_repo.create(user_id, term_id)
        else:
            self._learning_repo.touch_learned(instance)
        self._learning_cache.delete_combine(deck_id, user_id)
        self.record_study_activity(user)
        return instance

    def record_correct(self, progress, user):
        self._learning_repo.record_correct(progress)
        self._learning_cache.delete_combine(progress.term.deck_id, user.id)
        self.record_study_activity(user)

    def record_incorrect(self, progress, user):
        self._learning_repo.record_incorrect(progress)
        self._learning_cache.delete_combine(progress.term.deck_id, user.id)
        self.record_study_activity(user)

    def toggle_remember(self, progress):
        self._learning_repo.toggle_skip(progress)

    def adjust_priority(self, progress, adjust_point):
        if adjust_point:
            self._learning_repo.adjust_priority(progress, adjust_point)

    def record_quick_revise_answer(self, user, term_id):
        progress, _ = self._learning_repo.get_or_create(user, term_id)
        self._learning_repo.record_quick_revise_answer(progress)
        self._learning_cache.delete_combine(progress.term.deck_id, user.id)
        self.record_study_activity(user)

    def get_latest_learned_term_info(self, user, deck_id, page_size=10):
        if self._term_context is None:
            raise RuntimeError("term_context is not configured")
        return self._term_context.get_latest_learned_term_info(user, deck_id, page_size)

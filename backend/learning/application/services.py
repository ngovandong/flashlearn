from datetime import timedelta

from django.utils import timezone

from backend.learning.infrastructure.cache import learning_progress_cache
from backend.learning.infrastructure.repository import LearningRepository
from backend.models import User
from backend.shared.application.exceptions import NotFoundError
from backend.term.infrastructure.repository import TermRepository
from backend.user.infrastructure.repository import UserRepository


class LearningService:
    @staticmethod
    def get_learning_progress(deck_id, user):
        progress = learning_progress_cache.get_combine(deck_id, user.id)
        if progress:
            return progress

        queryset = LearningRepository.get_progress_for_user_deck(user.id, deck_id)
        deck_term = LearningRepository.count_deck_terms(deck_id)
        total = len(queryset)
        today = timezone.localtime(timezone.now()).date()

        left = deck_term - total
        completed = 0
        learned_today = 0

        for term in queryset:
            if term[2].date() == today or term[3].date() == today:
                learned_today += 1
            if term[1] and term[1] > 5:
                completed += 1

        progress = (
            deck_term,
            {"learning": total - completed, "completed": completed, "left": left, "learned_today": learned_today},
        )
        learning_progress_cache.set_combine(deck_id, user.id, progress)
        return progress

    @classmethod
    def record_study_activity(cls, user: User, cache=None) -> None:
        from backend.shared.infrastructure.cache import default_cache

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
        UserRepository.clear_cache(user.id, cache or default_cache)

    @staticmethod
    def get_learning_streak(user: User) -> dict:
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        last = user.last_study_date
        studied_today = last == today

        if last == today or last == yesterday:
            streak = user.learning_streak_count
        else:
            streak = 0

        return {"streak": streak, "studied_today": studied_today}

    @staticmethod
    def clear_learning_progress(deck_id, user):
        LearningRepository.clear_for_deck(deck_id, user)
        learning_progress_cache.delete_combine(deck_id, user.id)

    @staticmethod
    def create_or_touch_progress(user, term_id, user_id):
        term = TermRepository.get_by_id(term_id)
        if term is None:
            raise NotFoundError("term not found")
        deck_id = term.deck_id
        instance = LearningRepository.get_by_user_and_term(user, term_id)
        if instance is None:
            instance = LearningRepository.create(user_id, term_id)
        else:
            LearningRepository.touch_learned(instance)
        learning_progress_cache.delete_combine(deck_id, user_id)
        LearningService.record_study_activity(user)
        return instance

    @staticmethod
    def record_correct(progress, user):
        LearningRepository.record_correct(progress)
        learning_progress_cache.delete_combine(progress.term.deck_id, user.id)
        LearningService.record_study_activity(user)

    @staticmethod
    def record_incorrect(progress, user):
        LearningRepository.record_incorrect(progress)
        learning_progress_cache.delete_combine(progress.term.deck_id, user.id)
        LearningService.record_study_activity(user)

    @staticmethod
    def toggle_remember(progress):
        LearningRepository.toggle_skip(progress)

    @staticmethod
    def adjust_priority(progress, adjust_point):
        if adjust_point:
            LearningRepository.adjust_priority(progress, adjust_point)

    @staticmethod
    def record_quick_revise_answer(user, term_id):
        progress, _ = LearningRepository.get_or_create(user, term_id)
        LearningRepository.record_quick_revise_answer(progress)
        learning_progress_cache.delete_combine(progress.term.deck_id, user.id)
        LearningService.record_study_activity(user)

    @staticmethod
    def get_latest_learned_term_info(user, deck_id, page_size=10):
        deck_terms = TermRepository.get_terms_for_deck(deck_id=deck_id, user=user).all()
        last_learned_term = TermRepository.get_last_learned_term(user, deck_id)
        if last_learned_term:
            last_learned_index = last_learned_term.id
            for index, t in enumerate(deck_terms):
                if t.id == last_learned_term.id:
                    last_learned_index = index
            default_page = last_learned_index // page_size + 1
            return {
                "default_page": default_page,
                "latest_id": last_learned_term.id,
                "last_learned_index": last_learned_index,
            }
        return {"default_page": 1, "latest_id": "", "last_learned_index": 0}

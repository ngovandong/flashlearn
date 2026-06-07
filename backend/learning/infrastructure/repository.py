from django.utils import timezone

from backend.constants.raw_query import LEARNING_PROGRESS_QUERY
from backend.models import Term, UserLearningProgress
from backend.utils.db_utils import execute_raw_sql


class LearningRepository:
    @staticmethod
    def get_progress_for_user_deck(user_id, deck_id):
        return execute_raw_sql(LEARNING_PROGRESS_QUERY, [user_id, deck_id])

    @staticmethod
    def count_deck_terms(deck_id):
        return Term.objects.filter(deck_id=deck_id).count()

    @staticmethod
    def get_by_user_and_term(user, term_id):
        return UserLearningProgress.objects.filter(user=user, term_id=term_id).first()

    @staticmethod
    def get_by_id(progress_id):
        return UserLearningProgress.objects.filter(pk=progress_id).first()

    @staticmethod
    def create(user_id, term_id):
        return UserLearningProgress.objects.create(user_id=user_id, term_id=term_id)

    @staticmethod
    def save(progress):
        progress.save()

    @staticmethod
    def get_or_create(user, term_id):
        return UserLearningProgress.objects.get_or_create(user=user, term_id=term_id)

    @staticmethod
    def clear_for_deck(deck_id, user):
        UserLearningProgress.objects.filter(term__deck_id=deck_id, user=user).delete()

    @staticmethod
    def touch_learned(progress):
        progress.last_learned_at = timezone.now()
        progress.total_revisions += 1
        progress.save()

    @staticmethod
    def record_correct(progress):
        progress.score += 2
        progress.total_revisions += 1
        progress.last_revised_at = timezone.now()
        progress.save()

    @staticmethod
    def record_incorrect(progress):
        progress.score -= 3
        progress.total_revisions += 1
        progress.last_revised_at = timezone.now()
        progress.save()

    @staticmethod
    def toggle_skip(progress):
        progress.is_skip = not progress.is_skip
        progress.save()

    @staticmethod
    def adjust_priority(progress, adjust_point):
        progress.score += adjust_point
        progress.save()

    @staticmethod
    def record_quick_revise_answer(progress):
        progress.score += 1
        progress.total_revisions += 1
        progress.last_revised_at = timezone.now()
        progress.save()

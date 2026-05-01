from django.utils import timezone

from ..constants.raw_query import LEARNING_PROGRESS_QUERY
from ..models import Term, UserLearningProgress
from .cache import RESOURCE, CacheService

learning_progress_cache = CacheService.factory(RESOURCE.LEARNING_PROGRESS)


class LearningService:
    @staticmethod
    def get_learning_progress(deck_id, user):
        progress = learning_progress_cache.get_combine(deck_id, user.id)
        if progress:
            return progress
        else:
            from ..utils.db_utils import execute_raw_sql

            queryset = execute_raw_sql(LEARNING_PROGRESS_QUERY, [user.id, deck_id])
            deck_term = Term.objects.filter(deck_id=deck_id).count()
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

    def clear_learning_progress(deck_id, user):
        UserLearningProgress.objects.filter(term__deck_id=deck_id, user=user).delete()

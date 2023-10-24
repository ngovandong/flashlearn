from django.db.models import Q, F, Count, Case, When, IntegerField
from django.utils import timezone
from ..models import Term, UserLearningProgress
from .cache import CacheService, RESOURCE
from ..constants.raw_query import LEARNING_PROGRESS_QUERY


# class LearningService:
#     @staticmethod
#     def get_learning_progress(deck_id, user):
#         filter = Q(deck_id=deck_id)

#         terms = Term.objects.filter(filter).annotate(completed=Count(
#             Case(
#                 When(Q(learning_progress__user=user) & (
#                      Q(learning_progress__score__gte=5) | Q(learning_progress__is_skip=True)), then=1),
#                 output_field=IntegerField(),
#             )
#         ), learning=Count(
#             Case(
#                 When(learning_progress__user=user,
#                      learning_progress__score__lt=5, learning_progress__is_skip=False, then=1),
#                 output_field=IntegerField(),
#             )
#         ))
#         # completed_count = terms.aggregate(completed_count=Sum('completed'))[
#         #     "completed_count"]
#         # learning_count = terms.aggregate(learning_count=Sum('learning'))[
#         #     "learning_count"]

#         number_of_terms = len(terms)
#         completed_count = 0
#         learning_count = 0

#         for term in terms:
#             completed_count += term.completed
#             learning_count += term.learning

#         left_count = number_of_terms-(completed_count+learning_count)

#         return number_of_terms, {"learning": learning_count, "completed": completed_count, "left": left_count}

#     def clear_learning_progress(deck_id, user):
#         UserLearningProgress.objects.filter(
#             term__deck_id=deck_id, user=user).delete()


learning_progress_cache = CacheService.factory(
    RESOURCE.LEARNING_PROGRESS)


class LearningService:
    @staticmethod
    # def get_learning_progress(deck_id, user):
    #     progress = learning_progress_cache.get_combine(deck_id, user.id)
    #     if progress:
    #         return progress
    #     else:
    #         learning = Term.objects.get_learning_terms(
    #             user=user, deck_id=deck_id).count()
    #         completed = Term.objects.get_completed_terms(
    #             user=user, deck_id=deck_id).count()
    #         left = Term.objects.get_unlearned_terms(
    #             user=user, deck_id=deck_id).count()
    #         learned_today = Term.objects.get_learned_today_terms(
    #             user=user, deck_id=deck_id).count()
    #         progress = learning + completed + \
    #             left, {"learning": learning, "completed": completed,
    #                    "left": left, "learned_today": learned_today}
    #         learning_progress_cache.set_combine(deck_id, user.id, progress)
    #     return progress
    def get_learning_progress(deck_id, user):
        progress = learning_progress_cache.get_combine(deck_id, user.id)
        if progress:
            return progress
        else:
            from ..utils.db_utils import execute_raw_sql
            queryset = execute_raw_sql(
                LEARNING_PROGRESS_QUERY, user_id=user.id, deck_id=deck_id)
            deck_term = Term.objects.filter(deck_id=deck_id).count()
            total = len(queryset)
            today = timezone.localtime(timezone.now()).date()

            left = deck_term - total
            completed = 0
            learned_today = 0

            for term in queryset:
                if term[2] and term[3].date() == today:
                    learned_today += 1

                if term[1] and term[1] > 5:
                    completed += 1

            progress = deck_term, {"learning": total - completed, "completed": completed,
                                   "left": left, "learned_today": learned_today}
            learning_progress_cache.set_combine(deck_id, user.id, progress)
            return progress

    def clear_learning_progress(deck_id, user):
        UserLearningProgress.objects.filter(
            term__deck_id=deck_id, user=user).delete()

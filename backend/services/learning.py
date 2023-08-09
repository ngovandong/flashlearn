from django.db.models import Q, F, Count, Case, When, IntegerField
from django.utils import timezone
from ..models import Term, UserLearningProgress
from .cache import CacheService, RESOURCE


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
            queryset = Term.objects.filter(
                Q(learning_progress__user_id=user.id) | Q(
                    learning_progress__user_id__isnull=True),
                deck_id=deck_id
            ).annotate(
                score=F('learning_progress__score'),
                last_learned_at=F('learning_progress__last_learned_at'),
                last_revised_at=F('learning_progress__last_revised_at')
            ).values(
                'id', 'name', 'score', 'last_learned_at', 'last_revised_at'
            )

            total = len(queryset)
            today = timezone.localtime(timezone.now()).date()

            left = 0
            completed = 0
            learned_today = 0

            for term in queryset:
                if term['score'] is None:
                    left += 1

                if term['last_revised_at'] and term['last_revised_at'].date() == today:
                    learned_today += 1

                if term['score'] and term['score'] > 5:
                    completed += 1
            progress = total, {"learning": total - completed - left, "completed": completed,
                               "left": left, "learned_today": learned_today}
            learning_progress_cache.set_combine(deck_id, user.id, progress)
            return progress

    def clear_learning_progress(deck_id, user):
        UserLearningProgress.objects.filter(
            term__deck_id=deck_id, user=user).delete()

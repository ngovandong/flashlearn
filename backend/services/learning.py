# from ..models import Term, UserLearningProgress
# from django.db.models import Q, Count, Case, When, IntegerField


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

from ..models import Term, UserLearningProgress


class LearningService:
    @staticmethod
    def get_learning_progress(deck_id, user):
        learning = Term.objects.get_learning_terms(
            user=user, deck_id=deck_id).count()
        completed = Term.objects.get_completed_terms(
            user=user, deck_id=deck_id).count()
        left = Term.objects.get_unlearned_terms(
            user=user, deck_id=deck_id).count()

        return learning + completed + left, {"learning": learning, "completed": completed, "left": left}

    def clear_learning_progress(deck_id, user):
        UserLearningProgress.objects.filter(
            term__deck_id=deck_id, user=user).delete()

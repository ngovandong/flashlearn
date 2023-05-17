from ..models import Term, UserLearningProgress
from django.db.models import Q, Count, Case, When, IntegerField


class LearningService:
    @staticmethod
    def get_learning_progress(deck_id, user):
        filter = Q(deck_id=deck_id)

        terms = Term.objects.filter(filter).annotate(completed=Count(
            Case(
                When(learning_progress__user=user,
                     learning_progress__score__gte=5, then=1),
                output_field=IntegerField(),
            )
        ), learning=Count(
            Case(
                When(learning_progress__user=user,
                     learning_progress__score__lt=5, then=1),
                output_field=IntegerField(),
            )
        ))
        # completed_count = terms.aggregate(completed_count=Sum('completed'))[
        #     "completed_count"]
        # learning_count = terms.aggregate(learning_count=Sum('learning'))[
        #     "learning_count"]

        number_of_terms = len(terms)
        completed_count = 0
        learning_count = 0

        for term in terms:
            completed_count += term.completed
            learning_count += term.learning

        left_count = number_of_terms-(completed_count+learning_count)

        return number_of_terms, {"learning": learning_count, "completed": completed_count, "left": left_count}

    def clear_learning_progress(deck_id, user):
        UserLearningProgress.objects.filter(
            term__deck_id=deck_id, user=user).delete()

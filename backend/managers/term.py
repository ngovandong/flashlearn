from django.db.models import Manager, OuterRef, Q, QuerySet, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone


class TermManager(Manager):
    def get_terms_for_deck(self, deck_id: int, user=None) -> QuerySet:
        """
        Returns the terms for the given deck.
        When user is given, total_revisions is scoped to that user via Subquery
        so the join does not duplicate rows (one row per other user's progress).
        """
        qs = self.filter(deck_id=deck_id)
        if user is not None:
            from ..models import UserLearningProgress

            progress = UserLearningProgress.objects.filter(
                term_id=OuterRef("pk"),
                user_id=user.id,
            )
            qs = qs.annotate(
                total_revisions=Coalesce(Subquery(progress.values("total_revisions")[:1]), 0),
                learning_progress_id=Subquery(progress.values("id")[:1]),
            )
        return qs

    def get_learned_terms(self, user, deck_id: int) -> QuerySet:
        filter = Q(deck_id=deck_id)
        filter &= Q(learning_progress__user=user)
        return self.filter(filter)

    def get_last_learned_term(self, user, deck_id: int):
        learned_terms = self.get_learned_terms(user, deck_id)
        return learned_terms.order_by("-learning_progress__last_learned_at").first()

    def get_learning_terms(self, user, deck_id: int) -> QuerySet:
        filter = Q(deck_id=deck_id)
        filter &= Q(learning_progress__user=user)
        filter &= Q(learning_progress__is_skip=False)
        filter &= Q(learning_progress__score__lt=5)
        return self.filter(filter)

    def get_learned_today_terms(self, user, deck_id: int) -> QuerySet:
        today = timezone.now().date()
        filter = Q(deck_id=deck_id)
        filter &= Q(learning_progress__user=user)
        filter &= Q(learning_progress__last_revised_at__date=today)
        return self.filter(filter)

    def get_completed_terms(self, user, deck_id: int) -> QuerySet:
        filter = Q(deck_id=deck_id)
        filter &= Q(learning_progress__user=user)
        filter &= Q(learning_progress__is_skip=True) | Q(learning_progress__score__gte=5)
        return self.filter(filter)

    def get_unlearned_terms(self, user, deck_id: int) -> QuerySet:
        learned_terms = self.get_learned_terms(user, deck_id)
        return self.get_terms_for_deck(deck_id).exclude(pk__in=learned_terms)

    def get_random_terms(self, deck_id: int) -> QuerySet:
        all_deck_terms = self.get_terms_for_deck(deck_id=deck_id).values("id", "name")
        return all_deck_terms.order_by("?")[:50]

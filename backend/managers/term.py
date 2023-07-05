from django.db.models import Manager, Q, QuerySet, F
from django.utils import timezone


class TermManager(Manager):
    def get_terms_for_deck(self, deck_id: int) -> QuerySet:
        """
        Returns the terms for the given deck.
        """
        return self.filter(deck_id=deck_id)

    # query 2 time but better performance if has many learning progress
    # def get_learned_terms(self, user, deck_id: int) -> QuerySet:
    #     """
    #     Returns the terms that the given user has learned for the given deck.
    #     """
    #     from ..models import UserLearningProgress
    #     prefetch = Prefetch(
    #         'learning_progress', queryset=UserLearningProgress.objects.filter(user=user))
    #     return self.filter(deck_id=deck_id).prefetch_related(prefetch)

    def get_learned_terms(self, user, deck_id: int) -> QuerySet:
        """
        Returns the terms that the given user has learned for the given deck.
        """
        filter = Q(deck_id=deck_id)
        filter &= Q(learning_progress__user=user)
        return self.filter(filter)

    def get_last_learned_term(self, user, deck_id: int):
        """
        Returns the last learned term by the given user for the given deck, or None if there are no learned terms.
        """
        learned_terms = self.get_learned_terms(user, deck_id)
        try:
            return learned_terms.order_by('-learning_progress__last_learned_at')[0]
        except IndexError:
            return None

    def get_learning_terms(self, user, deck_id: int) -> QuerySet:
        """
        Returns the terms that the given user has completed for the given deck.
        """
        filter = Q(deck_id=deck_id)
        filter &= Q(learning_progress__user=user)
        filter &= Q(learning_progress__is_skip=False)
        filter &= Q(learning_progress__score__lt=5)
        return self.filter(filter)

    def get_completed_terms(self, user, deck_id: int) -> QuerySet:
        """
        Returns the terms that the given user has completed for the given deck.
        """
        filter = Q(deck_id=deck_id)
        filter &= Q(learning_progress__user=user)
        filter &= Q(learning_progress__is_skip=True) | Q(
            learning_progress__score__gte=5)
        return self.filter(filter)

    def get_unlearned_terms(self, user, deck_id: int) -> QuerySet:
        """
        Returns the terms that the given user has not yet learned for the given deck.
        """
        learned_terms = self.get_learned_terms(user, deck_id)
        return self.get_terms_for_deck(deck_id).exclude(pk__in=learned_terms)

    def get_revise_terms(self, user, deck_id: int) -> QuerySet:
        """
        Returns the terms to revise for the given deck.
        """
        today = timezone.now().date()
        filter = Q(deck_id=deck_id)
        filter &= Q(learning_progress__is_skip=False)
        filter &= Q(learning_progress__user=user)
        revise_terms = self.filter(filter).annotate(
            learning_progress_id=F('learning_progress__id'),
            delta_day=today-F("learning_progress__last_revised_at__date")
        ).order_by(
            "-delta_day", 'learning_progress__score')[:5]
        return revise_terms

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

        return {"learning": learning, "completed": completed, "left": left}

    def clear_learning_progress(deck_id, user):
        UserLearningProgress.objects.filter(
            term__deck_id=deck_id, user=user).delete()

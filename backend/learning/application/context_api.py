"""Public API for other bounded contexts — no infrastructure imports from outside."""


class LearningContextApi:
    def __init__(self, learning_service, learning_cache):
        self._learning_service = learning_service
        self._learning_cache = learning_cache

    def clear_learning_progress(self, deck_id, user):
        self._learning_service.clear_learning_progress(deck_id, user)

    def invalidate_progress_cache(self, deck_id, user_id):
        self._learning_cache.delete_combine(deck_id, user_id)

    def get_learning_progress(self, deck_id, user):
        return self._learning_service.get_learning_progress(deck_id, user)

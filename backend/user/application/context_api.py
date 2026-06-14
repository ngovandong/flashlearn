"""Public API for user-related operations from other contexts."""


class UserContextApi:
    def __init__(self, user_repo, cache):
        self._user_repo = user_repo
        self._cache = cache

    def clear_cache(self, user_id, cache=None):
        self._user_repo.clear_cache(user_id, cache or self._cache)

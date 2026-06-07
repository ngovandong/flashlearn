from enum import Enum

from backend.shared.infrastructure.cache import default_cache


class RESOURCE(Enum):
    LEARNING_PROGRESS = 1
    DECK = 2
    TERM = 3


class _CacheNamespace:
    PREFIX = ""
    LIVE_TIME = 60

    def __init__(self, prefix: str, live_time: int | None = 60):
        self.PREFIX = prefix
        self.LIVE_TIME = live_time
        self._cache = default_cache

    def get_combine_key(self, first_key, second_key):
        if first_key and second_key:
            return "_".join([self.PREFIX, str(first_key).strip(), str(second_key).strip()])

    def get_key(self, key):
        if key:
            return "_".join([self.PREFIX, str(key).strip()])

    def get(self, key):
        return self._cache.get(self.get_key(key))

    def get_combine(self, first_key, second_key):
        return self._cache.get(self.get_combine_key(first_key, second_key))

    def set(self, key, value):
        return self._cache.set(self.get_key(key), value, self.LIVE_TIME)

    def set_combine(self, first_key, second_key, value):
        return self._cache.set(self.get_combine_key(first_key, second_key), value, self.LIVE_TIME)

    def delete(self, key):
        self._cache.delete(self.get_key(key))

    def delete_combine(self, first_key, second_key):
        self._cache.delete(self.get_combine_key(first_key, second_key))

    def clear_all(self):
        self._cache.delete_pattern(f"{self.PREFIX}_*")


class LearningProgressCache(_CacheNamespace):
    def __init__(self):
        super().__init__(prefix="learning_progress", live_time=60 * 5)


class DeckTermsCache(_CacheNamespace):
    def __init__(self):
        super().__init__(prefix="term", live_time=None)


def cache_factory(source: RESOURCE):
    if source == RESOURCE.LEARNING_PROGRESS:
        return LearningProgressCache()
    if source == RESOURCE.TERM:
        return DeckTermsCache()
    return _CacheNamespace(prefix="", live_time=60)


learning_progress_cache = LearningProgressCache()

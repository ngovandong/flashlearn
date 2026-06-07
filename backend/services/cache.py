"""Backward-compatible cache re-exports."""

from backend.learning.infrastructure.cache import (
    DeckTermsCache,
    LearningProgressCache,
    cache_factory,
    learning_progress_cache,
)


class CacheService:
    PREFIX = ""
    LIVE_TIME = 60

    @staticmethod
    def factory(source):
        return cache_factory(source)

    @classmethod
    def get_combine_key(cls, first_key, second_key):
        return LearningProgressCache().get_combine_key(first_key, second_key)

    @classmethod
    def get_key(cls, key):
        return LearningProgressCache().get_key(key)

    @classmethod
    def get(cls, key):
        return learning_progress_cache.get(key)

    @classmethod
    def get_combine(cls, first_key, second_key):
        return learning_progress_cache.get_combine(first_key, second_key)

    @classmethod
    def set(cls, key, value):
        return learning_progress_cache.set(key, value)

    @classmethod
    def set_combine(cls, first_key, second_key, value):
        return learning_progress_cache.set_combine(first_key, second_key, value)

    @classmethod
    def delete(cls, key):
        return learning_progress_cache.delete(key)

    @classmethod
    def delete_combine(cls, first_key, second_key):
        return learning_progress_cache.delete_combine(first_key, second_key)

    @classmethod
    def clear_all(cls):
        return learning_progress_cache.clear_all()


class _LearningProgressCache(LearningProgressCache):
    pass


class _DeckTermsCache(DeckTermsCache):
    pass

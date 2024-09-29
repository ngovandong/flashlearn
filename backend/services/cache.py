from enum import Enum
from core.cache import cache


class RESOURCE(Enum):
    LEARNING_PROGRESS = 1
    DECK = 2
    TERM = 3


class CacheService:
    PREFIX = ""
    LIVE_TIME = 60

    @staticmethod
    def factory(source):
        if source == RESOURCE.LEARNING_PROGRESS:
            return _LearningProgressCache
        if source == RESOURCE.TERM:
            return _DeckTermsCache

    @classmethod
    def get_combine_key(cls, first_key, second_key):
        if first_key and second_key:
            first_key = str(first_key).strip()
            second_key = str(second_key).strip()
            return "_".join([cls.PREFIX, first_key, second_key])

    @classmethod
    def get_key(cls, key):
        if key:
            key = str(key).strip()
            return "_".join([cls.PREFIX, key])

    @classmethod
    def get(cls, key):
        key = cls.get_key(key)
        return cache.get(key)

    @classmethod
    def get_combine(cls, first_key, second_key):
        key = cls.get_combine_key(first_key, second_key)
        return cache.get(key)

    @classmethod
    def set(cls, key, value):
        key = cls.get_key(key)
        return cache.set(key, value, cls.LIVE_TIME)

    @classmethod
    def set_combine(cls, first_key, second_key, value):
        key = cls.get_combine_key(first_key, second_key)
        return cache.set(key, value, cls.LIVE_TIME)

    @classmethod
    def delete(cls, key):
        key = cls.get_key(key)
        cache.delete(key)

    @classmethod
    def delete_combine(cls, first_key, second_key):
        key = cls.get_combine_key(first_key, second_key)
        cache.delete(key)


class _LearningProgressCache(CacheService):
    PREFIX = "learning_progress"
    LIVE_TIME = 60 * 5


class _DeckTermsCache(CacheService):
    PREFIX = "term"
    LIVE_TIME = None

from django.conf import settings
from django.core.cache import cache as redis_cache


class SKIP_REDIS:
    @staticmethod
    def get(key):
        return None

    @staticmethod
    def set(key, value, timeout=None):
        pass

    @staticmethod
    def delete(key):
        pass


cache = None

if settings.SKIP_REDIS == "1":
    cache = SKIP_REDIS()
else:
    cache = redis_cache

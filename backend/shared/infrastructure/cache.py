from typing import Any

from core.cache import cache


class RedisCacheAdapter:
    """Infrastructure adapter wrapping Django Redis cache."""

    def get(self, key: str) -> Any:
        return cache.get(key)

    def set(self, key: str, value: Any, timeout: int | None = None) -> None:
        cache.set(key, value, timeout=timeout)

    def delete(self, key: str) -> None:
        cache.delete(key)

    def delete_pattern(self, pattern: str) -> None:
        cache.delete_pattern(pattern)


default_cache = RedisCacheAdapter()

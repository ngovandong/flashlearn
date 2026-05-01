import logging

logger = logging.getLogger(__name__)


def cleanup_learning_cache():
    """
    Evict stale learning-progress cache entries.
    Runs every hour.
    """
    from ..services.cache import RESOURCE, CacheService

    cache = CacheService.factory(RESOURCE.LEARNING_PROGRESS)
    cache.clear_all()
    logger.info("Learning progress cache cleared")

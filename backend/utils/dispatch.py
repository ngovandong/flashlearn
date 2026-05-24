import logging
from collections.abc import Callable

logger = logging.getLogger(__name__)


def dispatch(func: Callable, *args, queue_name: str = "default", **kwargs) -> None:
    """
    Enqueue func if an RQ worker is running on queue_name, otherwise call it directly.
    This lets the app work without a worker running (e.g. local dev without Redis).
    """
    if _has_active_worker(queue_name):
        from django_rq import get_queue

        get_queue(queue_name).enqueue(func, *args, **kwargs)
        logger.info("Task %s enqueued to '%s' queue", func.__name__, queue_name)
    else:
        logger.info("No worker on '%s' queue — running %s directly", queue_name, func.__name__)
        func(*args, **kwargs)


def _has_active_worker(queue_name: str = "default") -> bool:
    try:
        from django_rq import get_connection
        from rq import Worker

        conn = get_connection(queue_name)
        workers = Worker.all(connection=conn)
        return any(any(q.name == queue_name for q in w.queues) for w in workers)
    except Exception:
        return False

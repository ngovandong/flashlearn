from backend.tasks.maintenance import cleanup_learning_cache

from .registry import CronJob

jobs: list[CronJob] = [
    CronJob(
        id="cleanup_learning_cache",
        cron="0 * * * *",  # every hour
        func=cleanup_learning_cache,
    ),
]

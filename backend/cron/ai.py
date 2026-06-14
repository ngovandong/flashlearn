from backend.tasks.ai import fill_terms_with_ai

from .registry import CronJob

jobs: list[CronJob] = [
    CronJob(
        id="fill_terms_with_ai",
        cron="*/2 * * * *",  # every 2 minutes
        func=fill_terms_with_ai,
    ),
]

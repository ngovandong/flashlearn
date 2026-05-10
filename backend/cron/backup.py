from backend.tasks.backup import dump_database_to_drive

from .registry import CronJob

jobs: list[CronJob] = [
    CronJob(
        id="daily_database_backup",
        cron="0 3 * * *",  # 10:00 Vietnam time (UTC+7)
        func=dump_database_to_drive,
    ),
]

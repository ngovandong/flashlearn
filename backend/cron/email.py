from backend.tasks.email import send_daily_reminders

from .registry import CronJob

jobs: list[CronJob] = [
    CronJob(
        id="daily_reminders",
        cron="0 1 * * *",  # 08:00 Vietnam time (UTC+7)
        func=send_daily_reminders,
    ),
]

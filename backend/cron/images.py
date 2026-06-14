from backend.tasks.images import convert_term_images_to_base64

from .registry import CronJob

jobs: list[CronJob] = [
    CronJob(
        id="convert_term_images_to_base64",
        cron="0 4 * * *",  # 11:00 Vietnam time (UTC+7)
        func=convert_term_images_to_base64,
    ),
]

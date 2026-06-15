from backend.tasks.speaking import prewarm_speaking_audio

from .registry import CronJob

jobs: list[CronJob] = [
    CronJob(
        id="prewarm_speaking_audio",
        cron="*/2 * * * *",  # every 2 minutes
        func=prewarm_speaking_audio,
    ),
]

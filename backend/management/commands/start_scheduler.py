from django.core.management.base import BaseCommand
from django_rq import get_connection
from rq_scheduler import Scheduler


class Command(BaseCommand):
    help = "Start the RQ scheduler and register all cron jobs"

    def handle(self, *args, **options):
        from backend.cron import register_jobs

        conn = get_connection("default")
        scheduler = Scheduler(connection=conn, queue_name="default")

        # Cancel existing scheduled jobs to prevent duplicates on restart
        cancelled = 0
        for job in scheduler.get_jobs():
            scheduler.cancel(job)
            cancelled += 1
        if cancelled:
            self.stdout.write(f"Cancelled {cancelled} existing scheduled job(s)")

        register_jobs(scheduler)
        self.stdout.write(self.style.SUCCESS("Cron jobs registered. Starting scheduler..."))

        scheduler.run()

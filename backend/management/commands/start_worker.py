import logging
import threading
import time

from django.core.management.base import BaseCommand
from django_rq import get_connection
from rq import Worker
from rq_scheduler import Scheduler

logger = logging.getLogger(__name__)


def _scheduler_loop(scheduler: Scheduler) -> None:
    """Run the scheduler tick loop without installing signal handlers.

    scheduler.run() calls _install_signal_handlers() which only works on the
    main thread. We replicate the loop body here so it is safe to call from a
    background thread.
    """
    while True:
        scheduler.enqueue_jobs()
        time.sleep(scheduler._interval)


class Command(BaseCommand):
    help = "Start RQ worker + cron scheduler in a single process"

    def handle(self, *args, **options):
        from backend.cron import register_jobs

        conn = get_connection("default")

        # ── Register cron jobs ────────────────────────────────────────────────
        scheduler = Scheduler(connection=conn, queue_name="default")

        cancelled = sum(1 for job in scheduler.get_jobs() if scheduler.cancel(job) or True)
        if cancelled:
            self.stdout.write(f"Cleared {cancelled} existing scheduled job(s)")

        register_jobs(scheduler)
        self.stdout.write(self.style.SUCCESS("Cron jobs registered"))

        # ── Run scheduler in a background daemon thread ───────────────────────
        scheduler_thread = threading.Thread(
            target=_scheduler_loop,
            args=(scheduler,),
            name="rq-scheduler",
            daemon=True,  # exits automatically when the worker (main thread) stops
        )
        scheduler_thread.start()
        self.stdout.write("Scheduler thread started")

        # ── Run worker on main thread (blocking) ─────────────────────────────
        self.stdout.write(self.style.SUCCESS("Starting worker..."))
        worker = Worker(["default"], connection=conn)
        worker.work()

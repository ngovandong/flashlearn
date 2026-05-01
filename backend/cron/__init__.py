from rq_scheduler import Scheduler

from . import email, maintenance

# Add new domain modules here to include their jobs
_MODULES = [
    email,
    maintenance,
]


def register_jobs(scheduler: Scheduler) -> None:
    """Collect jobs from all domain modules and register them with the scheduler."""
    for module in _MODULES:
        for job in module.jobs:
            scheduler.cron(
                job.cron,
                func=job.func,
                id=job.id,
                use_local_timezone=job.use_local_timezone,
            )

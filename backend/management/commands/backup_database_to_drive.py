from django.core.management.base import BaseCommand

from backend.tasks.backup import dump_database_to_drive


class Command(BaseCommand):
    help = "Dump the database and upload it to Google Drive immediately (same as the daily cron job)."

    def handle(self, *args, **options):
        try:
            dump_database_to_drive()
        except RuntimeError as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
            return

        self.stdout.write(self.style.SUCCESS("Database backup uploaded to Google Drive."))

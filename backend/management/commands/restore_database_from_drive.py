from django.conf import settings
from django.core.management.base import BaseCommand

from backend.tasks.backup import get_latest_backup_file, restore_database_from_drive


class Command(BaseCommand):
    help = "Download the latest database backup from Google Drive and restore it."

    def add_arguments(self, parser):
        parser.add_argument(
            "-y",
            "--yes",
            action="store_true",
            help="Skip confirmation prompt.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show which backup would be restored without applying it.",
        )

    def handle(self, *args, **options):
        try:
            latest = get_latest_backup_file()
        except RuntimeError as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
            return

        if not latest:
            self.stderr.write(self.style.ERROR("No backup files found on Google Drive."))
            return

        db_name = settings.DATABASES["default"]["NAME"]
        self.stdout.write(f"Latest backup: {latest['name']} (created {latest['createdTime']}, id={latest['id']})")
        self.stdout.write(f"Target database: {db_name}")

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("Dry run — no changes made."))
            return

        if not options["yes"]:
            self.stdout.write(self.style.WARNING(f"This will replace all data in '{db_name}' with the backup above."))
            answer = input("Type 'yes' to continue: ").strip().lower()
            if answer != "yes":
                self.stdout.write("Aborted.")
                return

        try:
            restore_database_from_drive(latest)
        except RuntimeError as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
            return

        self.stdout.write(self.style.SUCCESS(f"Database '{db_name}' restored from {latest['name']}."))

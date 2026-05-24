from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "One-time OAuth2 flow to authorize Google Drive access for database backups."

    def handle(self, *args, **options):
        import os

        from google_auth_oauthlib.flow import InstalledAppFlow

        from backend.tasks.backup import DRIVE_CREDENTIALS_PATH, DRIVE_SCOPES, DRIVE_TOKEN_PATH

        if not os.path.exists(DRIVE_CREDENTIALS_PATH):
            self.stderr.write(
                self.style.ERROR(
                    f"OAuth credentials file not found at '{DRIVE_CREDENTIALS_PATH}'.\n"
                    "Download 'Desktop app' OAuth2 credentials from Google Cloud Console\n"
                    "(APIs & Services → Credentials) and save them to that path."
                )
            )
            return

        flow = InstalledAppFlow.from_client_secrets_file(DRIVE_CREDENTIALS_PATH, DRIVE_SCOPES)
        creds = flow.run_local_server(port=0)

        with open(DRIVE_TOKEN_PATH, "w") as f:
            f.write(creds.to_json())

        self.stdout.write(self.style.SUCCESS(f"Token saved to '{DRIVE_TOKEN_PATH}'. Backup cron is ready."))

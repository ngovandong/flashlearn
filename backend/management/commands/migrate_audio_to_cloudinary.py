"""Move inline base64 TTS audio out of the database and onto Cloudinary.

Each ``SpeakingAudioClip`` row caches synthesized audio as base64 text, which
inflates the table to hundreds of MB. This command uploads the raw bytes to
Cloudinary (``resource_type="raw"``, keeping the exact MP3/PCM bytes), saves the
hosted URL on the row, and clears the inline base64 to reclaim space.

Run the database backup FIRST so the bytes survive outside Cloudinary, then:

    uv run python manage.py migrate_audio_to_cloudinary --dry-run   # count only
    uv run python manage.py migrate_audio_to_cloudinary             # upload + purge base64
    uv run python manage.py migrate_audio_to_cloudinary --limit 500 # one batch
    uv run python manage.py migrate_audio_to_cloudinary --keep-audio  # don't clear base64

After a full run, reclaim the freed pages with:
    OPTIMIZE TABLE backend_speakingaudioclip;
"""

from django.core.management.base import BaseCommand

from backend.services import speaking_service


class Command(BaseCommand):
    help = "Upload inline base64 audio clips to Cloudinary and store only the URL."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report how many clips would be migrated.")
        parser.add_argument("--limit", type=int, default=None, help="Migrate at most this many clips this run.")
        parser.add_argument(
            "--keep-audio",
            action="store_true",
            help="Keep the DB base64 after uploading (default: clear it to reclaim space).",
        )

    def handle(self, *args, **opts):
        dry_run = opts["dry_run"]

        def on_progress(uploaded, failed, total):
            if uploaded % 100 == 0:
                self.stdout.write(f"  {uploaded}/{total} uploaded ({failed} failed)…")

        try:
            stats = speaking_service.migrate_audio_to_storage(
                max_clips=opts["limit"],
                purge_audio=not opts["keep_audio"],
                dry_run=dry_run,
                on_progress=None if dry_run else on_progress,
            )
        except RuntimeError as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"Dry run — {stats['pending']} clips would be uploaded to Cloudinary.")
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Uploaded {stats['uploaded']} clips • {stats['failed']} failed "
                f"• base64 {'cleared' if stats['purged'] else 'kept'}."
            )
        )
        if stats["purged"] and stats["uploaded"]:
            self.stdout.write("Run `OPTIMIZE TABLE backend_speakingaudioclip;` to shrink the table file on disk.")

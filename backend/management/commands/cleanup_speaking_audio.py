"""Delete orphaned Speaking Coach TTS audio clips from the shared cache.

The ``SpeakingAudioClip`` table caches synthesized audio (base64 PCM) keyed by
``(voice, text)`` and never expires, so it grows unbounded as conversations are
deleted and course dialogues are re-crawled. This command keeps only the clips
still referenced by a saved conversation line, a course lesson line, or the
per-voice picker demo, and deletes the rest.

    uv run python manage.py cleanup_speaking_audio --dry-run   # preview only
    uv run python manage.py cleanup_speaking_audio             # delete orphans
"""

from django.core.management.base import BaseCommand

from backend.services import course_service, speaking_service


class Command(BaseCommand):
    help = "Delete orphaned Speaking Coach TTS audio clips no feature references."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report how many clips would be deleted without deleting them.",
        )

    def handle(self, *args, **opts):
        dry_run = opts["dry_run"]
        # Course dialogues reuse the shared clip cache; pass their live keys in so
        # the speaking cleanup never deletes a clip a course lesson still plays.
        course_keys = course_service.referenced_audio_clip_keys()

        stats = speaking_service.prune_orphan_audio_clips(
            extra_referenced_keys=course_keys,
            dry_run=dry_run,
        )

        self.stdout.write(
            f"Scanned {stats['scanned']} clips • {stats['referenced']} referenced keys "
            f"({len(course_keys)} from courses) • {stats['orphans']} orphans"
        )
        if dry_run:
            total_bytes = 0
            for preview in stats["previews"]:
                size_kb = (preview["audio_len"] or 0) / 1024
                total_bytes += preview["audio_len"] or 0
                text = " ".join((preview["text"] or "").split())
                self.stdout.write(f"  [{preview['voice']}] {size_kb:6.1f} KB  {text}")
            self.stdout.write(
                self.style.WARNING(
                    f"Dry run — {stats['orphans']} clips would be deleted (~{total_bytes / 1024 / 1024:.1f} MB freed)."
                )
            )
        else:
            self.stdout.write(self.style.SUCCESS(f"Deleted {stats['deleted']} orphaned clips."))

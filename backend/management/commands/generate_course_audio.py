"""Generate per-character dialogue audio for imported courses via Azure TTS.

Collects every dialogue character across a course's lessons, classifies each
name's likely gender, assigns a matching Azure neural voice, stamps that voice
onto every line, then synthesizes one cached audio clip per distinct
``(voice, sentence)`` into the shared SpeakingAudioClip table.

Run after ``crawl_english_courses``:
    uv run python manage.py generate_course_audio
    uv run python manage.py generate_course_audio --courses a2-english-for-developers
    uv run python manage.py generate_course_audio --regenerate
"""

from django.core.management.base import BaseCommand

from backend.services import course_service
from backend.shared.infrastructure.ai import AiProviderError


class Command(BaseCommand):
    help = "Generate Azure TTS audio for course dialogue characters."

    def add_arguments(self, parser):
        parser.add_argument("--courses", default="", help="Comma list of course slugs (default: all).")
        parser.add_argument("--regenerate", action="store_true", help="Re-synthesize even if cached.")
        parser.add_argument("--verbose-lines", action="store_true", help="Print each synthesized line.")

    def handle(self, *args, **opts):
        slugs = [s.strip() for s in opts["courses"].split(",") if s.strip()]
        courses = course_service.courses()
        if slugs:
            courses = [c for c in courses if c.slug in slugs]
        if not courses:
            self.stderr.write("No matching courses found. Run crawl_english_courses first.")
            return

        on_progress = (lambda msg: self.stdout.write(f"    {msg}")) if opts["verbose_lines"] else None
        for course in courses:
            self.stdout.write(self.style.MIGRATE_HEADING(f"Generating audio for {course.title}…"))
            try:
                stats = course_service.generate_course_audio(
                    course, regenerate=opts["regenerate"], on_progress=on_progress
                )
            except AiProviderError as exc:
                self.stderr.write(f"  {exc}")
                return
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Voices: {stats['voices']} • clips made: {stats['made']} • "
                    f"cached: {stats['skipped']} • failed: {stats['failed']} "
                    f"({stats['clips']} distinct lines)"
                )
            )

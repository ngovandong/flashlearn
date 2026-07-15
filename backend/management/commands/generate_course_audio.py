"""Generate per-character dialogue audio for imported courses.

Collects every dialogue character across a course's lessons, classifies each
name's likely gender, assigns a matching neural voice, stamps that voice onto
every line, then synthesizes one cached audio clip per distinct
``(voice, sentence)`` into the shared SpeakingAudioClip table.

The TTS engine is selectable with ``--tts``:

* ``azure``      — Azure neural voices (cloud; needs AZURE_SPEECH_KEY/REGION).
* ``elevenlabs`` — ElevenLabs voices (cloud; needs ELEVENLABS_API_KEY).
* ``kokoro``     — local open-source Kokoro-82M (free/offline; ``uv sync --group
  tts`` and ``brew install espeak-ng``).

Run after ``crawl_english_courses``::

    uv run python manage.py generate_course_audio
    uv run python manage.py generate_course_audio --tts kokoro --regenerate
    uv run python manage.py generate_course_audio --courses a2-english-for-developers

Regenerate a single lesson (by id) and reclaim the old audio it replaces::

    uv run python manage.py generate_course_audio \
        --lesson 57e45a18-1fde-4ba3-bcff-e0d80c2ad622 --tts kokoro --regenerate --delete-old

Audition every engine (synthesize one sentence per provider, play it, and time
how fast it generates) before committing to one::

    uv run python manage.py generate_course_audio --preview
"""

import base64
import shutil
import subprocess
from pathlib import Path

from django.core.management.base import BaseCommand

from backend.services import course_service, speaking_service
from backend.shared.application.exceptions import NotFoundError
from backend.shared.infrastructure.ai import TTS_PROVIDER_NAMES, AiProviderError

_PREVIEW_TEXT = "It should, but it's not displaying because the live server extension might not be running."
_MIME_EXT = {"audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav"}


class Command(BaseCommand):
    help = "Generate course dialogue audio (Azure/ElevenLabs/Kokoro), or preview each engine."

    def add_arguments(self, parser):
        parser.add_argument("--courses", default="", help="Comma list of course slugs (default: all).")
        parser.add_argument(
            "--lesson",
            default="",
            help="Regenerate only this lesson id (UUID); overrides --courses.",
        )
        parser.add_argument(
            "--tts",
            default="azure",
            choices=list(TTS_PROVIDER_NAMES),
            help="TTS engine to synthesize with (default: azure).",
        )
        parser.add_argument("--regenerate", action="store_true", help="Re-synthesize even if cached.")
        parser.add_argument(
            "--delete-old",
            action="store_true",
            help="After generating, delete now-orphaned old audio from Cloudinary + DB "
            "(safe: only clips no lesson/conversation still references).",
        )
        parser.add_argument("--verbose-lines", action="store_true", help="Print each synthesized line.")
        parser.add_argument(
            "--preview",
            action="store_true",
            help="Audition every TTS engine on one sentence (play + timing), then exit.",
        )
        parser.add_argument("--preview-text", default=_PREVIEW_TEXT, help="Sentence to synthesize in --preview.")
        parser.add_argument(
            "--preview-out", default="tts_previews", help="Folder to save preview clips (default: tts_previews/)."
        )
        parser.add_argument("--no-play", action="store_true", help="Don't auto-play preview clips.")

    def handle(self, *args, **opts):
        if opts["preview"]:
            self._preview(opts)
            return
        self._generate(opts)

    # ── Preview / benchmark every engine ──────────────────────────────────
    def _preview(self, opts):
        text = opts["preview_text"]
        out_dir = Path(opts["preview_out"])
        out_dir.mkdir(parents=True, exist_ok=True)
        player = None if opts["no_play"] else shutil.which("afplay")

        self.stdout.write(self.style.MIGRATE_HEADING(f'Previewing TTS engines on:\n  "{text}"'))
        results = course_service.preview_tts(text, list(TTS_PROVIDER_NAMES))

        for entry in results:
            provider = entry["provider"]
            if not entry["ok"]:
                gender = entry.get("gender")
                tag = f"{provider}/{gender}" if gender else provider
                self.stdout.write(self.style.WARNING(f"  {tag}: skipped — {entry['error']}"))
                continue

            ext = _MIME_EXT.get(entry["mime_type"], ".bin")
            path = out_dir / f"{provider}_{entry['gender']}_{entry['voice']}{ext}"
            path.write_bytes(base64.b64decode(entry["audio"]))
            self.stdout.write(
                self.style.SUCCESS(
                    f"  {provider}/{entry['gender']} ({entry['voice']}): {entry['seconds']:.2f}s → {path}"
                )
            )
            if player:
                subprocess.run([player, str(path)], check=False)  # noqa: S603 — fixed afplay path

        self.stdout.write(
            f"\nClips saved in {out_dir}/. Pick one and generate with: "
            f"--tts <{'|'.join(TTS_PROVIDER_NAMES)}> --regenerate"
        )

    # ── Audio generation (single lesson or whole courses) ─────────────────
    def _generate(self, opts):
        on_progress = (lambda msg: self.stdout.write(f"    {msg}")) if opts["verbose_lines"] else None
        ok = self._generate_lesson(opts, on_progress) if opts["lesson"] else self._generate_courses(opts, on_progress)
        if ok and opts["delete_old"]:
            self._delete_orphan_audio()

    def _generate_lesson(self, opts, on_progress):
        self.stdout.write(self.style.MIGRATE_HEADING(f"Generating {opts['tts']} audio for lesson {opts['lesson']}…"))
        try:
            stats = course_service.generate_lesson_audio(
                opts["lesson"], provider=opts["tts"], regenerate=opts["regenerate"], on_progress=on_progress
            )
        except NotFoundError as exc:
            self.stderr.write(f"  {exc}")
            return False
        except AiProviderError as exc:
            self.stderr.write(f"  {exc}")
            return False
        self._write_stats(stats)
        return True

    def _generate_courses(self, opts, on_progress):
        slugs = [s.strip() for s in opts["courses"].split(",") if s.strip()]
        courses = course_service.courses()
        if slugs:
            courses = [c for c in courses if c.slug in slugs]
        if not courses:
            self.stderr.write("No matching courses found. Run crawl_english_courses first.")
            return False

        for course in courses:
            self.stdout.write(self.style.MIGRATE_HEADING(f"Generating {opts['tts']} audio for {course.title}…"))
            try:
                stats = course_service.generate_course_audio(
                    course, provider=opts["tts"], regenerate=opts["regenerate"], on_progress=on_progress
                )
            except AiProviderError as exc:
                self.stderr.write(f"  {exc}")
                return False
            self._write_stats(stats)
        return True

    def _write_stats(self, stats):
        self.stdout.write(
            self.style.SUCCESS(
                f"  Voices: {stats['voices']} • clips made: {stats['made']} • "
                f"cached: {stats['skipped']} • failed: {stats['failed']} "
                f"({stats['clips']} distinct lines)"
            )
        )

    def _delete_orphan_audio(self):
        # Reuses the speaking-audio cleanup: only clips no course lesson or saved
        # conversation still references are removed, so it's safe to run after a
        # provider/voice switch leaves the old clips orphaned.
        course_keys = course_service.referenced_audio_clip_keys()
        stats = speaking_service.prune_orphan_audio_clips(extra_referenced_keys=course_keys, delete_remote=True)
        self.stdout.write(
            self.style.SUCCESS(
                f"  Cleanup: deleted {stats['deleted']} orphaned clips "
                f"({stats['remote_deleted']} removed from Cloudinary); "
                f"{stats['referenced']} keys still referenced."
            )
        )

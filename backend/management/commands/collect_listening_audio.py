"""Mirror dictation sentence audio to our CDN (with a TTS fallback).

For every listening exercise, each sentence's original recording is fetched into
our own Cloudinary (so runtime playback never depends on the source site). A
sentence with no source recording is synthesized with the Speaking Coach TTS
pipeline instead; anything that can't be hosted falls back to the browser's
speech synthesizer at runtime.

Run after ``crawl_dictation``::

    uv run python manage.py collect_listening_audio
    uv run python manage.py collect_listening_audio --topics english-conversations
    uv run python manage.py collect_listening_audio --topics all --regenerate

Audio hosting is I/O-bound (Cloudinary + TTS), so exercises are processed
concurrently; tune the pool size with ``--workers``.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.management.base import BaseCommand
from django.db import connections

from backend.services import listening_service


class Command(BaseCommand):
    help = "Mirror dictation sentence audio to Cloudinary (TTS fallback for missing recordings)."

    def add_arguments(self, parser):
        parser.add_argument("--topics", default="", help="Comma list of topic slugs, or 'all'/'' for every topic.")
        parser.add_argument("--regenerate", action="store_true", help="Re-host even already-hosted sentences.")
        parser.add_argument("--verbose-lines", action="store_true", help="Print each hosted/failed sentence.")
        parser.add_argument(
            "--workers",
            type=int,
            default=8,
            help="Number of exercises to host in parallel (I/O-bound). Use 1 to run serially.",
        )

    def handle(self, *args, **opts):
        exercises = self._exercises(opts["topics"])
        if not exercises:
            self.stderr.write("No matching exercises found. Run crawl_dictation first.")
            return

        workers = max(1, opts["workers"])
        totals = {"mirrored": 0, "generated": 0, "skipped": 0, "failed": 0}

        if workers == 1:
            results = (self._process(ex, opts["regenerate"], opts["verbose_lines"]) for ex in exercises)
        else:
            pool = ThreadPoolExecutor(max_workers=workers)
            futures = [pool.submit(self._process, ex, opts["regenerate"], opts["verbose_lines"]) for ex in exercises]
            results = (f.result() for f in as_completed(futures))

        try:
            for exercise, stats, lines in results:
                for key in totals:
                    totals[key] += stats[key]
                for line in lines:
                    self.stdout.write(line)
                self.stdout.write(
                    f"  {exercise.key}: mirrored {stats['mirrored']} • generated {stats['generated']} • "
                    f"cached {stats['skipped']} • failed {stats['failed']}"
                )
        finally:
            if workers != 1:
                pool.shutdown()

        self.stdout.write(
            self.style.SUCCESS(
                f"Done: mirrored {totals['mirrored']} • generated {totals['generated']} • "
                f"cached {totals['skipped']} • failed {totals['failed']} across {len(exercises)} exercises."
            )
        )

    @staticmethod
    def _process(exercise, regenerate, verbose):
        """Host one exercise's audio. Runs in a worker thread, so it uses its own
        DB connection (Django connections are thread-local) and closes it to avoid
        leaking. Progress lines are buffered and returned so the main thread can
        print them without interleaving across threads."""
        lines = []
        on_progress = (lambda msg: lines.append(f"    {msg}")) if verbose else None
        try:
            stats = listening_service.mirror_exercise_audio(exercise, regenerate=regenerate, on_progress=on_progress)
        finally:
            connections.close_all()
        return exercise, stats, lines

    def _exercises(self, topics_opt):
        raw = (topics_opt or "").strip().lower()
        if not raw or raw == "all":
            return listening_service.exercises_for_topic_slug_all()
        exercises = []
        for slug in [s.strip() for s in raw.split(",") if s.strip()]:
            exercises.extend(listening_service.exercises_for_topic_slug(slug))
        return exercises

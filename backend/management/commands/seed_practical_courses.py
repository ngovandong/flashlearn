"""Seed ten short, practical English courses (5 A2, 4 B1, 1 B2) into the DB.

Unlike ``crawl_english_courses`` (which fetches freeCodeCamp), the content here is
authored locally in ``_practical_course_content.COURSES``. To avoid generating any
new character/scene art, each lesson reuses the character images + backgrounds
already mirrored to Cloudinary by the a2/b1 crawl: authored character names are
resolved to their existing ``images`` maps and ``background`` stems to their hosted
URLs via ``course_service.asset_palette()``. The only image produced is a small
per-course topic SVG cover, uploaded to Cloudinary and stored on ``Course.background``.

Lessons are keyed by a stable ``<course-slug>/<section-slug>/<lesson-slug>`` natural
key (distinct from the a2/b1 superblock slugs), so role-play progress survives a
re-seed and ``crawl_english_courses --clean`` never touches these courses.

Audio is NOT generated here. Run it afterwards:
    uv run python manage.py seed_practical_courses
    uv run python manage.py generate_course_audio
"""

from django.core.management.base import BaseCommand

from backend.management.commands._practical_course_content import COURSES, make_cover_svg
from backend.services import course_service
from backend.shared.application.exceptions import NotFoundError, ValidationError


class Command(BaseCommand):
    help = "Seed the authored practical A2/B1/B2 courses, reusing existing character art + backgrounds."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete these seeded courses before re-inserting (only their own slugs; a2/b1 untouched).",
        )
        parser.add_argument(
            "--skip-covers",
            action="store_true",
            help="Skip generating + uploading the per-course SVG cover (no Cloudinary calls).",
        )

    def handle(self, *args, **opts):
        characters, backgrounds = course_service.asset_palette()
        if not characters:
            self.stderr.write(
                "No existing character art found. Run crawl_english_courses (a2/b1) first so "
                "the seeded courses can reuse the mirrored images."
            )
            return
        self.stdout.write(f"Palette: {len(characters)} characters with art, {len(backgrounds)} backgrounds.")

        if opts["clean"]:
            slugs = [c["slug"] for c in COURSES]
            course_service.clean_courses(slugs)
            self.stdout.write(self.style.WARNING(f"Cleaned existing seeded courses: {len(slugs)}"))

        total_sections = total_lessons = 0
        for cfg in COURSES:
            sections, lessons = self._seed_course(cfg, characters, backgrounds, opts["skip_covers"])
            total_sections += sections
            total_lessons += lessons

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(COURSES)} courses, {total_sections} sections, {total_lessons} lessons. "
                f"Run generate_course_audio next to voice the new lines."
            )
        )

    def _seed_course(self, cfg, characters, backgrounds, skip_covers):
        self.stdout.write(self.style.MIGRATE_HEADING(f"Seeding {cfg['title']} ({cfg['level']})…"))
        course = course_service.import_course(
            slug=cfg["slug"],
            defaults={
                "title": cfg["title"],
                "level": cfg["level"],
                "description": cfg["description"],
                "source": "flashlearn-practical",
                "order": cfg["order"],
            },
        )

        if not skip_covers:
            self._generate_cover(cfg)

        section_count = lesson_count = 0
        for s_order, sec in enumerate(cfg["sections"]):
            section = course_service.import_section(
                course=course,
                slug=sec["slug"],
                defaults={
                    "title": sec["title"],
                    "description": sec.get("description", ""),
                    "order": s_order,
                },
            )
            section_count += 1
            for l_order, lesson in enumerate(sec["lessons"]):
                defaults = self._build_lesson(cfg, sec, lesson, l_order, characters, backgrounds, section)
                course_service.import_lesson(key=f"{cfg['slug']}/{sec['slug']}/{lesson['slug']}", defaults=defaults)
                lesson_count += 1
        self.stdout.write(f"  {section_count} sections, {lesson_count} lessons.")
        return section_count, lesson_count

    def _generate_cover(self, cfg):
        try:
            svg = make_cover_svg(cfg["title"], cfg["level"], cfg["cover"])
            url = course_service.set_course_cover_svg(cfg["slug"], svg)
            self.stdout.write(f"  cover → {url}")
        except (ValidationError, NotFoundError) as exc:
            self.stderr.write(f"  cover generation skipped: {exc}")

    def _build_lesson(self, cfg, sec, lesson, order, characters, backgrounds, section):
        # Each character is placed on a side; first → left, second → right, etc. Lines
        # inherit their speaker's side so the scene mirrors the existing a2/b1 layout.
        names = lesson["characters"]
        side = {name: ("left" if i % 2 == 0 else "right") for i, name in enumerate(names)}

        resolved_characters = []
        for name in names:
            art = characters.get(name)
            if art is None:
                self.stderr.write(f"    WARN: no art for character '{name}' in {lesson['slug']}")
                art = {"role": "", "images": {}}
            resolved_characters.append(
                {"name": name, "role": art.get("role", ""), "voice": "", "images": art.get("images", {})}
            )

        lines = [
            {"speaker": speaker, "text": text, "align": side.get(speaker, "left"), "voice": ""}
            for speaker, text in lesson["lines"]
        ]

        bg_stem = lesson.get("background", "")
        background = backgrounds.get(bg_stem, "")
        if bg_stem and not background:
            self.stderr.write(f"    WARN: no background '{bg_stem}' for {lesson['slug']}")

        return {
            "section": section,
            "slug": lesson["slug"],
            "title": lesson["title"],
            "description": lesson.get("description", ""),
            "order": order,
            "characters": resolved_characters,
            "lines": lines,
            "background": background,
            "exercises": [self._build_exercise(ex) for ex in lesson.get("exercises", [])],
        }

    @staticmethod
    def _build_exercise(ex):
        if ex["kind"] == "fill_blank":
            return {
                "kind": "fill_blank",
                "title": ex.get("title", ""),
                "prompt": ex.get("prompt", ""),
                "sentence": ex.get("sentence", ""),
                "blanks": [{"answer": a, "feedback": ""} for a in ex.get("answers", [])],
            }
        return {
            "kind": "choice",
            "title": ex.get("title", ""),
            "prompt": ex.get("prompt", ""),
            "questions": ex.get("questions", []),
        }

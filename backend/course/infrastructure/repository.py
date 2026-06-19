"""Persistence for the Course feature.

All Django ORM access for courses, sections, lessons, generated character audio
(cached in the shared SpeakingAudioClip table) and per-user lesson progress lives
here so the application service and the DRF viewset never touch the ORM directly.
"""

from pathlib import PurePosixPath
from urllib.parse import urlparse

from django.db.models import Prefetch
from django.utils import timezone

from backend.models import (
    Course,
    CourseLesson,
    CourseSection,
    SpeakingAudioClip,
    UserCourseLessonProgress,
)


class CourseRepository:
    # ── Catalog reads ─────────────────────────────────────────────────────
    @staticmethod
    def list_courses(level=None):
        qs = Course.objects.all()
        if level:
            qs = qs.filter(level=level)
        return qs

    @staticmethod
    def available_levels():
        """Distinct non-empty course levels (e.g. ``["A2", "B1"]``), curriculum-ordered."""
        levels = Course.objects.exclude(level="").order_by("level").values_list("level", flat=True).distinct()
        return list(levels)

    @staticmethod
    def get_course(slug):
        return Course.objects.filter(slug=slug).first()

    @staticmethod
    def sections_with_lessons(course):
        """Course sections, each with its ordered lessons prefetched."""
        return course.sections.prefetch_related(
            Prefetch("lessons", queryset=CourseLesson.objects.order_by("order"))
        ).order_by("order")

    @staticmethod
    def get_lesson(lesson_id):
        return CourseLesson.objects.filter(id=lesson_id).select_related("section__course").first()

    @staticmethod
    def lesson_ids_for_course(course):
        return list(CourseLesson.objects.filter(section__course=course).values_list("id", flat=True))

    @staticmethod
    def lessons_for_course(course):
        """Every lesson of a course in curriculum order (for audio generation)."""
        return CourseLesson.objects.filter(section__course=course).order_by("section__order", "order")

    @staticmethod
    def asset_palette():
        """Reusable character art + scene backgrounds already mirrored to Cloudinary.

        Scans existing lessons and returns ``(characters_by_name, backgrounds_by_stem)``
        where ``characters_by_name`` is ``{name: {"role", "images"}}`` (only names with
        at least one mirrored image layer) and ``backgrounds_by_stem`` maps a scene's
        filename stem (e.g. ``"cafe"``) to its hosted URL. Lets the course seeder reuse
        the a2/b1 art instead of generating new character/scene images.
        """
        characters: dict[str, dict] = {}
        backgrounds: dict[str, str] = {}
        for lesson in CourseLesson.objects.all().only("characters", "background"):
            for character in lesson.characters or []:
                name = (character.get("name") or "").strip()
                images = character.get("images") or {}
                if name and images and name not in characters:
                    characters[name] = {"role": character.get("role", ""), "images": images}
            url = (lesson.background or "").strip()
            if url:
                stem = PurePosixPath(urlparse(url).path).stem
                backgrounds.setdefault(stem, url)
        return characters, backgrounds

    # ── Generated character audio (shared SpeakingAudioClip cache) ─────────
    @staticmethod
    def clip_hash(text):
        return SpeakingAudioClip.hash_text(text)

    @staticmethod
    def get_clip(voice, text_hash):
        return SpeakingAudioClip.objects.filter(voice=voice, text_hash=text_hash).first()

    @staticmethod
    def save_clip(*, voice, text_hash, text, audio, mime_type, audio_url=""):
        clip, _ = SpeakingAudioClip.objects.update_or_create(
            voice=voice,
            text_hash=text_hash,
            defaults={"text": text, "audio": audio, "audio_url": audio_url, "mime_type": mime_type},
        )
        return clip

    @staticmethod
    def referenced_clip_keys():
        """``(voice, text_hash)`` for every voiced line across all course lessons.

        Mirrors the keying ``generate_course_audio`` uses so a shared-cache
        cleanup keeps every clip a lesson can still play. Lines without an
        assigned voice are skipped (they can't be replayed, so no clip exists).
        """
        keys: set[tuple[str, str]] = set()
        for lines in CourseLesson.objects.values_list("lines", flat=True).iterator(chunk_size=200):
            for line in lines or []:
                if not isinstance(line, dict):
                    continue
                text = (line.get("text") or "").strip()
                voice = (line.get("voice") or "").strip()
                if text and voice:
                    keys.add((voice, SpeakingAudioClip.hash_text(text)))
        return keys

    @staticmethod
    def save_lesson_content(lesson):
        lesson.save(update_fields=["characters", "lines", "updated_at"])

    @staticmethod
    def save_course_background(course, background):
        course.background = background
        course.save(update_fields=["background", "updated_at"])
        return course

    # ── Progress (keyed on the lesson's stable natural key) ───────────────
    @staticmethod
    def get_progress(user, lesson):
        return UserCourseLessonProgress.objects.filter(user=user, lesson_key=lesson.key).first()

    @staticmethod
    def progress_for_course(user, course):
        """``{lesson_key: progress}`` for every lesson of ``course`` the user touched."""
        rows = UserCourseLessonProgress.objects.filter(user=user, lesson_key__startswith=f"{course.slug}/")
        return {row.lesson_key: row for row in rows}

    @staticmethod
    def get_or_create_progress(user, lesson):
        progress, _ = UserCourseLessonProgress.objects.get_or_create(user=user, lesson_key=lesson.key)
        return progress

    @staticmethod
    def record_attempt(user, lesson, *, score, passed, last_result=None):
        """Upsert progress for an attempt, keeping the best score and pass state.

        ``last_result`` (the latest role-play breakdown) is stored verbatim so the
        lesson page can replay it when the user revisits.
        """
        progress, _ = UserCourseLessonProgress.objects.get_or_create(user=user, lesson_key=lesson.key)
        progress.attempts += 1
        if score > progress.best_score:
            progress.best_score = score
        if passed and progress.status != UserCourseLessonProgress.STATUS_PASSED:
            progress.status = UserCourseLessonProgress.STATUS_PASSED
            progress.passed_at = timezone.now()
        if last_result is not None:
            progress.last_result = last_result
        progress.save()
        return progress

    @staticmethod
    def set_highlight(user, lesson, *, text, note="", remove=False):
        """Add, update or remove a noted word/phrase on a lesson (per user)."""
        progress, _ = UserCourseLessonProgress.objects.get_or_create(user=user, lesson_key=lesson.key)
        highlights = [h for h in (progress.highlights or []) if isinstance(h, dict) and h.get("text")]
        lowered = text.lower()
        existing = next((h for h in highlights if (h.get("text") or "").lower() == lowered), None)
        if remove:
            highlights = [h for h in highlights if (h.get("text") or "").lower() != lowered]
        elif existing is not None:
            existing["note"] = note
        else:
            highlights.append({"text": text, "note": note})
        progress.highlights = highlights
        progress.save(update_fields=["highlights", "updated_at"])
        return highlights

    # ── Importer upserts (used by the crawler) ────────────────────────────
    @staticmethod
    def upsert_course(slug, defaults):
        course, _ = Course.objects.update_or_create(slug=slug, defaults=defaults)
        return course

    @staticmethod
    def upsert_section(course, slug, defaults):
        section, _ = CourseSection.objects.update_or_create(course=course, slug=slug, defaults=defaults)
        return section

    @staticmethod
    def upsert_lesson(key, defaults):
        """Upsert a lesson by its stable global key, preserving the row across re-crawls."""
        lesson, _ = CourseLesson.objects.update_or_create(key=key, defaults=defaults)
        return lesson

    @staticmethod
    def delete_courses(slugs):
        """Delete courses (cascading sections + lessons). Progress is untouched
        because it is keyed on ``lesson_key``, not a lesson FK."""
        return Course.objects.filter(slug__in=list(slugs)).delete()

    @staticmethod
    def delete_course(course):
        """Delete a single course (cascading sections + lessons). Progress is
        untouched because it is keyed on ``lesson_key``, not a lesson FK."""
        return course.delete()

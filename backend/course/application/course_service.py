"""Course orchestration service.

Coordinates the course catalog/content (:class:`CourseRepository`), the Live
Role-play scoring (reusing the Speaking Coach's pronunciation analysis) and the
generation of per-character dialogue audio via Azure TTS. The DRF viewset stays a
thin transport layer.
"""

import base64
import logging

from backend.course.domain.progress import (
    COURSE_PASS_THRESHOLD,
    is_passing,
    role_play_score,
)
from backend.course.domain.voices import DEFAULT_VOICE
from backend.course.domain.voices import assign_voices as assign_character_voices
from backend.course.infrastructure.repository import CourseRepository
from backend.shared.application.exceptions import NotFoundError, ValidationError
from backend.shared.infrastructure.ai import AiProviderError
from backend.speaking.application.services import audio_clip_public_id

logger = logging.getLogger(__name__)

_GENDER_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "characters": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "gender": {"type": "STRING", "enum": ["male", "female", "unknown"]},
                },
                "required": ["name", "gender"],
            },
        }
    },
    "required": ["characters"],
}

_GENDER_SYSTEM = (
    "You classify the most likely gender of dialogue character names so each can be "
    "given a matching text-to-speech voice. Answer with a single JSON object matching "
    "the requested schema."
)


class CourseService:
    def __init__(
        self,
        *,
        repo=CourseRepository,
        speaking_service=None,
        ai=None,
        tts=None,
        image_storage=None,
        audio_storage=None,
    ):
        self._repo = repo
        # The Speaking Coach service supplies pronunciation analysis for role-play.
        self._speaking = speaking_service
        # ``ai`` classifies character gender; ``tts`` (Azure) synthesizes audio.
        self._ai = ai
        self._tts = tts
        # ``image_storage`` mirrors source character/background art to our CDN;
        # ``audio_storage`` hosts generated dialogue audio so it doesn't bloat the DB.
        self._image_storage = image_storage
        self._audio_storage = audio_storage

    # ── Catalog ───────────────────────────────────────────────────────────
    def courses(self):
        """Every imported course (used by the audio-generation command)."""
        return list(self._repo.list_courses())

    def list_courses_queryset(self, level=None):
        """The ordered course queryset (optionally filtered by ``level``), for the
        view to paginate before building summaries."""
        return self._repo.list_courses(level=level)

    def available_levels(self):
        """Distinct course levels for the catalog's level filter."""
        return self._repo.available_levels()

    def catalog(self, user, courses=None):
        """Courses with the user's passed/total lesson counts.

        ``courses`` may be a page of course objects (e.g. from the paginator); when
        omitted every imported course is summarized.
        """
        if courses is None:
            courses = list(self._repo.list_courses())
        result = []
        for course in courses:
            lesson_ids = self._repo.lesson_ids_for_course(course)
            progress = self._repo.progress_for_course(user, course)
            passed = sum(1 for p in progress.values() if p.status == p.STATUS_PASSED)
            result.append(
                {
                    "course": course,
                    "total_lessons": len(lesson_ids),
                    "passed_lessons": passed,
                }
            )
        return result

    def course_detail(self, user, slug):
        course = self._repo.get_course(slug)
        if course is None:
            raise NotFoundError("Course not found.")
        sections = list(self._repo.sections_with_lessons(course))
        progress = self._repo.progress_for_course(user, course)
        return {"course": course, "sections": sections, "progress": progress}

    def get_lesson(self, lesson_id):
        lesson = self._repo.get_lesson(lesson_id)
        if lesson is None:
            raise NotFoundError("Lesson not found.")
        return lesson

    def lesson_progress(self, user, lesson):
        return self._repo.get_progress(user, lesson)

    # ── Audio ─────────────────────────────────────────────────────────────
    def lesson_audio(self, lesson):
        """Per-line generated clips for a lesson: ``[{voice, text, audio, mime_type}]``.

        One entry per distinct ``(voice, text)`` pair whose audio has already been
        synthesized; lines without a cached clip are omitted so the transcript
        still works without audio.
        """
        out = []
        seen = set()
        for line in lesson.lines or []:
            voice = (line.get("voice") or "").strip()
            text = (line.get("text") or "").strip()
            if not voice or not text:
                continue
            key = (voice, text)
            if key in seen:
                continue
            seen.add(key)
            clip = self._repo.get_clip(voice, self._repo.clip_hash(text))
            if clip is not None:
                out.append(
                    {
                        "voice": voice,
                        "text": text,
                        "audio_url": clip.audio_url,
                        "audio": clip.audio,
                        "mime_type": clip.mime_type,
                    }
                )
        return out

    # ── Live Role-play ────────────────────────────────────────────────────
    def submit_role_play(self, user, *, lesson_id, segments):
        """Score a role-play sentence-by-sentence and update lesson progress.

        ``segments`` is ``[{"target_text", "audio", "mime_type"}]`` — one per line
        the learner spoke. Each is analysed on its own (mirroring the Speaking
        Coach's per-sentence breakdown) so the result is one reliable section per
        sentence instead of a single merged score. The lesson is marked passed
        only when the averaged score clears :data:`COURSE_PASS_THRESHOLD`. The
        breakdown is persisted so the lesson page can replay it on revisit.
        """
        lesson = self.get_lesson(lesson_id)
        clean = [
            s
            for s in (segments or [])
            if isinstance(s, dict) and (s.get("target_text") or "").strip() and (s.get("audio") or "").strip()
        ]
        if not clean:
            raise ValidationError("Nothing to score — the role-play has no spoken lines.")

        sessions = []
        for index, segment in enumerate(clean):
            text = segment["target_text"].strip()
            result = self._speaking.analyze_text(
                target_text=text,
                audio=segment["audio"],
                mime_type=segment.get("mime_type") or "audio/wav",
                full_session=False,
            )
            sessions.append({"id": index, "text": text, "result": result})

        count = len(sessions)
        avg_accuracy = round(sum(s["result"]["accuracyScore"] for s in sessions) / count)
        avg_fluency = round(sum(s["result"]["fluencyScore"] for s in sessions) / count)
        avg_completeness = round(sum(s["result"]["completenessScore"] for s in sessions) / count)
        score = role_play_score(avg_accuracy, avg_fluency, avg_completeness)
        passed = is_passing(score)

        last_result = {"sessions": sessions, "score": score, "passed": passed}
        progress = self._repo.record_attempt(user, lesson, score=score, passed=passed, last_result=last_result)
        return {
            "score": score,
            "passed": passed,
            "threshold": COURSE_PASS_THRESHOLD,
            "sessions": sessions,
            "progress": progress,
        }

    def set_lesson_highlight(self, user, lesson_id, *, text, note="", remove=False):
        """Add, update or remove a per-user noted highlight on a lesson."""
        lesson = self.get_lesson(lesson_id)
        return self._repo.set_highlight(user, lesson, text=text, note=note, remove=remove)

    # ── Import (crawler) ──────────────────────────────────────────────────
    def import_course(self, *, slug, defaults):
        return self._repo.upsert_course(slug, defaults)

    def import_section(self, *, course, slug, defaults):
        return self._repo.upsert_section(course, slug, defaults)

    def import_lesson(self, *, key, defaults):
        return self._repo.upsert_lesson(key, defaults)

    def clean_courses(self, slugs):
        """Delete the given courses' content before a fresh re-crawl. User
        role-play progress survives (it is keyed on the stable lesson key)."""
        return self._repo.delete_courses(slugs)

    def delete_course(self, slug):
        """Delete a single course (cascading its sections + lessons).

        User role-play progress survives because it is keyed on the stable lesson
        key, not a lesson FK.
        """
        course = self._repo.get_course(slug)
        if course is None:
            raise NotFoundError("Course not found.")
        self._repo.delete_course(course)

    def asset_palette(self):
        """Reusable character art + scene backgrounds from existing courses.

        Returns ``(characters_by_name, backgrounds_by_stem)`` so the course seeder
        can reuse the a2/b1 art (already mirrored to Cloudinary) instead of
        generating new character/scene images.
        """
        return self._repo.asset_palette()

    # ── Course cover art ──────────────────────────────────────────────────
    def set_course_background(self, slug, file_obj):
        """Upload a cover image for the course ``slug`` to Cloudinary and store its URL."""
        if self._image_storage is None:
            raise ValidationError("Image storage (Cloudinary) is not configured.")
        course = self._repo.get_course(slug)
        if course is None:
            raise NotFoundError(f"Course not found: {slug}")
        url = self._image_storage.upload_file(file_obj)
        if not url:
            raise ValidationError("Cloudinary returned no URL.")
        self._repo.save_course_background(course, url)
        return url

    def set_course_cover_svg(self, slug, svg_markup):
        """Upload a generated SVG cover for the course ``slug`` and store its URL.

        Uploaded at a deterministic ``public_id`` so re-seeding overwrites the same
        Cloudinary asset instead of orphaning copies.
        """
        if self._image_storage is None:
            raise ValidationError("Image storage (Cloudinary) is not configured.")
        course = self._repo.get_course(slug)
        if course is None:
            raise NotFoundError(f"Course not found: {slug}")
        url = self._image_storage.upload_svg(svg_markup, f"flashlearn/courses/covers/{slug}")
        if not url:
            raise ValidationError("Cloudinary returned no URL.")
        self._repo.save_course_background(course, url)
        return url

    def mirror_image(self, source_url, public_id):
        """Mirror a source image into our Cloudinary, returning the hosted URL.

        Falls back to the source URL if mirroring fails (e.g. Cloudinary not
        configured) and to ``""`` if the source itself is unavailable so callers
        can skip the asset.
        """
        if not source_url or self._image_storage is None:
            return source_url
        try:
            return self._image_storage.mirror_url(source_url, public_id) or source_url
        except Exception:  # noqa: BLE001 — best effort; never fail a crawl on a CDN hiccup
            logger.warning("Cloudinary mirror failed for %s", source_url)
            return source_url

    # ── Character voices + Azure TTS audio generation ─────────────────────
    def generate_course_audio(self, course, *, regenerate=False, on_progress=None):
        """Assign each character a voice, then synthesize every line via Azure TTS.

        Returns counts: ``{voices, made, skipped, failed, clips}``. Audio is cached
        in the shared SpeakingAudioClip table keyed by ``(voice, line text)``, so
        reruns are cheap unless ``regenerate`` is set.
        """
        if self._tts is None:
            raise AiProviderError("Azure TTS is not configured (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION).")

        voice_map = self.assign_course_voices(course)
        made = skipped = failed = 0
        seen: set[tuple[str, str]] = set()
        for lesson in self._repo.lessons_for_course(course):
            for line in lesson.lines or []:
                text = (line.get("text") or "").strip()
                voice = (line.get("voice") or "").strip() or voice_map.get(line.get("speaker")) or DEFAULT_VOICE
                if not text:
                    continue
                key = (voice, text)
                if key in seen:
                    continue
                seen.add(key)
                text_hash = self._repo.clip_hash(text)
                if not regenerate and self._repo.get_clip(voice, text_hash) is not None:
                    skipped += 1
                    continue
                try:
                    result = self._tts.synthesize(text, voice)
                    audio_url = self._upload_clip_audio(voice, text_hash, result["audio"])
                    self._repo.save_clip(
                        voice=voice,
                        text_hash=text_hash,
                        text=text,
                        audio="" if audio_url else result["audio"],
                        audio_url=audio_url,
                        mime_type=result["mime_type"],
                    )
                    made += 1
                    if on_progress:
                        on_progress(f"{voice}: {text[:48]}")
                except AiProviderError as exc:
                    failed += 1
                    logger.warning("Course TTS failed for %r (%s): %s", text[:48], voice, exc)
                    if on_progress:
                        on_progress(f"FAILED {voice}: {text[:48]} — {exc}")
        return {"voices": len(voice_map), "made": made, "skipped": skipped, "failed": failed, "clips": len(seen)}

    def _upload_clip_audio(self, voice, text_hash, audio_b64):
        """Upload base64 audio bytes to the audio store; return the URL (or "")."""
        if self._audio_storage is None or not audio_b64:
            return ""
        try:
            data = base64.b64decode(audio_b64)
            return self._audio_storage.upload_audio(data, public_id=audio_clip_public_id(voice, text_hash))
        except Exception:
            logger.exception("Course audio upload failed for clip (%s); keeping inline base64", voice)
            return ""

    def referenced_audio_clip_keys(self):
        """``(voice, text_hash)`` pairs for every course dialogue line still in the
        catalog. Used by the speaking-audio cleanup to keep clips course lessons
        reuse from the shared SpeakingAudioClip cache."""
        return self._repo.referenced_clip_keys()

    def assign_course_voices(self, course):
        """Classify every character's gender and stamp a voice onto lines/characters.

        Returns the ``{character_name: voice}`` map. Lessons are saved only when a
        voice actually changes, so reruns are stable and idempotent.
        """
        names = self._collect_character_names(course)
        if not names:
            return {}
        genders = self._classify_genders(names)
        voice_map = assign_character_voices(genders)

        for lesson in self._repo.lessons_for_course(course):
            changed = False
            for character in lesson.characters or []:
                voice = voice_map.get(character.get("name"))
                if voice and character.get("voice") != voice:
                    character["voice"] = voice
                    changed = True
            for line in lesson.lines or []:
                voice = voice_map.get(line.get("speaker"))
                if voice and line.get("voice") != voice:
                    line["voice"] = voice
                    changed = True
            if changed:
                self._repo.save_lesson_content(lesson)
        return voice_map

    def _collect_character_names(self, course):
        names: set[str] = set()
        for lesson in self._repo.lessons_for_course(course):
            for character in lesson.characters or []:
                name = (character.get("name") or "").strip()
                if name:
                    names.add(name)
            for line in lesson.lines or []:
                speaker = (line.get("speaker") or "").strip()
                if speaker:
                    names.add(speaker)
        return sorted(names, key=str.lower)

    def _classify_genders(self, names):
        """``{name: "male"|"female"|"unknown"}`` via the AI provider (best effort)."""
        if not self._ai:
            return {name: "unknown" for name in names}
        user_prompt = (
            "Classify the most likely gender of each of these dialogue character first "
            'names as "male", "female", or "unknown" if ambiguous: '
            f"{', '.join(names)}."
        )
        try:
            raw = self._ai.generate_json(_GENDER_SYSTEM, user_prompt, _GENDER_SCHEMA)
        except Exception:
            logger.exception("Character gender classification failed; defaulting to neutral voices")
            return {name: "unknown" for name in names}
        lookup = {name.lower(): name for name in names}
        result = {name: "unknown" for name in names}
        for entry in raw.get("characters") or []:
            if not isinstance(entry, dict):
                continue
            canonical = lookup.get((entry.get("name") or "").strip().lower())
            gender = (entry.get("gender") or "").strip().lower()
            if canonical and gender in ("male", "female"):
                result[canonical] = gender
        return result

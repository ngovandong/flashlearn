"""Course orchestration service.

Coordinates the course catalog/content (:class:`CourseRepository`), the Live
Role-play scoring (reusing the Speaking Coach's pronunciation analysis) and the
generation of per-character dialogue audio via Azure TTS. The DRF viewset stays a
thin transport layer.
"""

import base64
import logging
import time

from django.utils import timezone

from backend.course.domain.progress import (
    COURSE_PASS_THRESHOLD,
    is_passing,
    role_play_score,
)
from backend.course.domain.voices import assign_voices as assign_character_voices
from backend.course.domain.voices import default_voice, sample_voices
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
        tts_factory=None,
        image_storage=None,
        audio_storage=None,
    ):
        self._repo = repo
        # The Speaking Coach service supplies pronunciation analysis for role-play.
        self._speaking = speaking_service
        # ``ai`` classifies character gender; ``tts_factory(name)`` builds the
        # chosen TTS provider (azure / elevenlabs / kokoro) to synthesize audio.
        self._ai = ai
        self._tts_factory = tts_factory
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

    # ── Listen & type (dictation) ─────────────────────────────────────────
    def save_dictation(self, user, lesson_id, *, score, lines):
        """Persist a listen-and-type attempt so it can be replayed on revisit.

        The frontend evaluates the typed text against the transcript (a word-level
        diff for instant, intuitive feedback); here we only clamp the score and
        store the breakdown verbatim. Dictation never affects the lesson's pass
        status — it's a listening drill.

        ``lines`` is ``[{"target", "typed", "correct", "total"}]`` — one per
        transcript line. Returns the saved ``{score, lines, at}`` dictation dict.
        """
        lesson = self.get_lesson(lesson_id)
        try:
            score = max(0, min(100, int(round(float(score)))))
        except (TypeError, ValueError):
            raise ValidationError("Invalid dictation score.")
        clean_lines = [
            {
                "target": str(line.get("target") or ""),
                "typed": str(line.get("typed") or ""),
                "correct": int(line.get("correct") or 0),
                "total": int(line.get("total") or 0),
            }
            for line in (lines or [])
            if isinstance(line, dict)
        ]
        if not clean_lines:
            raise ValidationError("Nothing to save — the dictation has no lines.")
        dictation = {"score": score, "lines": clean_lines, "at": timezone.now().isoformat()}
        self._repo.save_dictation(user, lesson, dictation=dictation)
        return dictation

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

    # ── Character voices + TTS audio generation ───────────────────────────
    def _build_tts(self, provider):
        """Build (and validate) the chosen TTS provider via the injected factory."""
        if self._tts_factory is None:
            raise AiProviderError("No TTS factory is configured.")
        tts = self._tts_factory(provider)
        if not getattr(tts, "is_configured", True):
            raise AiProviderError(f"TTS provider {provider!r} is not available (missing credentials or not installed).")
        return tts

    def preview_tts(self, text, provider_names):
        """Audition each provider on ``text`` with a sample male + female voice.

        Returns one entry per attempted ``(provider, gender)`` with the generated
        audio and wall-clock synthesis time, so the audio-preview command can play
        the clip and report how fast each provider is::

            [{provider, gender, voice, ok, seconds, audio, mime_type, error}]
        """
        if self._tts_factory is None:
            raise AiProviderError("No TTS factory is configured.")
        factory = self._tts_factory
        results = []
        for name in provider_names:
            try:
                tts = factory(name)
            except ValueError as exc:
                results.append({"provider": name, "ok": False, "error": str(exc)})
                continue
            if not getattr(tts, "is_configured", True):
                results.append(
                    {"provider": name, "ok": False, "error": "not available (missing credentials or not installed)"}
                )
                continue
            for gender, voice in sample_voices(name).items():
                start = time.perf_counter()
                try:
                    out = tts.synthesize(text, voice)
                    results.append(
                        {
                            "provider": name,
                            "gender": gender,
                            "voice": voice,
                            "ok": True,
                            "seconds": time.perf_counter() - start,
                            "audio": out["audio"],
                            "mime_type": out["mime_type"],
                        }
                    )
                except Exception as exc:  # noqa: BLE001 — report per-voice failure, keep going
                    results.append({"provider": name, "gender": gender, "voice": voice, "ok": False, "error": str(exc)})
        return results

    def generate_course_audio(self, course, *, provider="azure", regenerate=False, on_progress=None):
        """Assign each character a voice, then synthesize every line via ``provider``.

        ``provider`` is one of ``azure`` | ``elevenlabs`` | ``kokoro``. Returns
        counts: ``{voices, made, skipped, failed, clips}``. Audio is cached in the
        shared SpeakingAudioClip table keyed by ``(voice, line text)``, so reruns
        are cheap unless ``regenerate`` is set.
        """
        tts = self._build_tts(provider)
        voice_map = self.assign_course_voices(course, provider=provider)
        lessons = list(self._repo.lessons_for_course(course))
        return self._synthesize_lessons(
            tts, lessons, voice_map, provider, regenerate=regenerate, on_progress=on_progress
        )

    def generate_lesson_audio(self, lesson_id, *, provider="azure", regenerate=False, on_progress=None):
        """Synthesize audio for a single lesson (by id) via ``provider``.

        Character→voice assignment is still computed course-wide so a character
        sounds the same across lessons, but only this lesson's voices are stamped
        and only its lines are synthesized — sibling lessons keep their existing
        voices/clips. Returns the same ``{voices, made, skipped, failed, clips}``.
        """
        tts = self._build_tts(provider)
        lesson = self._repo.get_lesson(lesson_id)
        if lesson is None:
            raise NotFoundError(f"Lesson not found: {lesson_id}")
        voice_map = self._course_voice_map(lesson.section.course, provider)
        self._stamp_lesson_voices(lesson, voice_map)
        return self._synthesize_lessons(
            tts, [lesson], voice_map, provider, regenerate=regenerate, on_progress=on_progress
        )

    def _synthesize_lessons(self, tts, lessons, voice_map, provider, *, regenerate=False, on_progress=None):
        """Synthesize + cache every distinct ``(voice, line text)`` across ``lessons``."""
        fallback_voice = default_voice(provider)
        made = skipped = failed = 0
        seen: set[tuple[str, str]] = set()
        for lesson in lessons:
            for line in lesson.lines or []:
                text = (line.get("text") or "").strip()
                voice = (line.get("voice") or "").strip() or voice_map.get(line.get("speaker")) or fallback_voice
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
                    result = tts.synthesize(text, voice)
                    # Re-uploads bust the CDN cache so a regenerated clip isn't served stale.
                    audio_url = self._upload_clip_audio(voice, text_hash, result["audio"], invalidate=regenerate)
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

    def _upload_clip_audio(self, voice, text_hash, audio_b64, *, invalidate=False):
        """Upload base64 audio bytes to the audio store; return the URL (or "")."""
        if self._audio_storage is None or not audio_b64:
            return ""
        try:
            data = base64.b64decode(audio_b64)
            return self._audio_storage.upload_audio(
                data, public_id=audio_clip_public_id(voice, text_hash), invalidate=invalidate
            )
        except Exception:
            logger.exception("Course audio upload failed for clip (%s); keeping inline base64", voice)
            return ""

    def referenced_audio_clip_keys(self):
        """``(voice, text_hash)`` pairs for every course dialogue line still in the
        catalog. Used by the speaking-audio cleanup to keep clips course lessons
        reuse from the shared SpeakingAudioClip cache."""
        return self._repo.referenced_clip_keys()

    def assign_course_voices(self, course, provider="azure"):
        """Classify every character's gender and stamp a ``provider`` voice onto
        every lesson's lines/characters.

        Returns the ``{character_name: voice}`` map. Lessons are saved only when a
        voice actually changes, so reruns are stable and idempotent. Switching
        providers restamps the voices (and naturally separates the audio cache,
        which is keyed by voice id).
        """
        voice_map = self._course_voice_map(course, provider)
        if not voice_map:
            return {}
        for lesson in self._repo.lessons_for_course(course):
            self._stamp_lesson_voices(lesson, voice_map)
        return voice_map

    def _course_voice_map(self, course, provider="azure"):
        """``{character_name: voice}`` for the whole course (classify + assign, no save)."""
        names = self._collect_character_names(course)
        if not names:
            return {}
        genders = self._classify_genders(names)
        return assign_character_voices(genders, provider)

    def _stamp_lesson_voices(self, lesson, voice_map):
        """Stamp the mapped voice onto one lesson's characters/lines; save if changed."""
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
        return changed

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

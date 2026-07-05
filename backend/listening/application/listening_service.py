"""Listening (dictation) orchestration service.

Coordinates the dictation catalog/content (:class:`ListeningRepository`), per-user
progress, and audio hosting. The DRF viewset stays a thin transport layer.

Audio strategy: each sentence's original recording is mirrored to our CDN by the
``collect_listening_audio`` command (``mirror_exercise_audio``). When a sentence
has no source recording, we fall back to synthesizing it with the Speaking Coach
TTS pipeline (cached in the shared ``SpeakingAudioClip`` table). At runtime the
frontend falls back once more to the browser's speech synthesizer if a clip URL
fails to load.
"""

import logging

from django.utils import timezone

from backend.listening.domain.scoring import clamp_score, is_complete
from backend.listening.infrastructure.repository import ListeningRepository
from backend.shared.application.exceptions import NotFoundError, ValidationError

logger = logging.getLogger(__name__)


class ListeningService:
    def __init__(
        self,
        *,
        repo=ListeningRepository,
        speaking_service=None,
        audio_storage=None,
        image_storage=None,
        translator=None,
        ai=None,
    ):
        self._repo = repo
        # Used only as the TTS fallback when a sentence has no source recording.
        self._speaking = speaking_service
        # Mirrors source recordings to our CDN so playback never depends on the
        # source site at runtime.
        self._audio_storage = audio_storage
        # Hosts each topic's SVG cover art (stored on ListeningTopic.background).
        self._image_storage = image_storage
        # Primary sentence translator (free Google endpoint); the AI provider is
        # the backup when it returns nothing.
        self._translator = translator
        self._ai = ai

    # ── Catalog ───────────────────────────────────────────────────────────
    def topics(self):
        """Every imported topic (used by the audio-collection command)."""
        return list(self._repo.list_topics())

    def catalog(self, user):
        """Topics with the user's completed/total exercise counts."""
        result = []
        for topic in self._repo.list_topics():
            exercise_ids = self._repo.exercise_ids_for_topic(topic)
            progress = self._repo.progress_for_topic(user, topic)
            completed = sum(1 for p in progress.values() if p.status == p.STATUS_COMPLETED)
            result.append(
                {
                    "topic": topic,
                    "total_exercises": len(exercise_ids),
                    "completed_exercises": completed,
                }
            )
        return result

    def topic_detail(self, user, slug):
        topic = self._repo.get_topic(slug)
        if topic is None:
            raise NotFoundError("Topic not found.")
        exercises = list(self._repo.exercises_for_topic(topic))
        progress = self._repo.progress_for_topic(user, topic)
        return {"topic": topic, "exercises": exercises, "progress": progress}

    def get_exercise(self, exercise_id):
        exercise = self._repo.get_exercise(exercise_id)
        if exercise is None:
            raise NotFoundError("Exercise not found.")
        return exercise

    def exercise_detail(self, user, exercise_id):
        """One exercise with the user's progress and its topic neighbours (prev/next)."""
        exercise = self.get_exercise(exercise_id)
        progress = self._repo.get_progress(user, exercise)
        siblings = list(self._repo.exercises_for_topic(exercise.topic).values_list("id", flat=True))
        prev_id = next_id = None
        try:
            idx = siblings.index(exercise.id)
            prev_id = siblings[idx - 1] if idx > 0 else None
            next_id = siblings[idx + 1] if idx < len(siblings) - 1 else None
        except ValueError:
            pass
        return {"exercise": exercise, "progress": progress, "prev_id": prev_id, "next_id": next_id}

    # ── Progress ──────────────────────────────────────────────────────────
    def submit_dictation(self, user, exercise_id, *, score, lines):
        """Persist a listen-and-type attempt and update completion state.

        The frontend evaluates the typed text against the transcript (a word-level
        diff for instant, intuitive feedback); here we only clamp the score, decide
        whether the exercise is now completed, and store the breakdown verbatim so
        mistakes can be re-highlighted on revisit.

        ``lines`` is ``[{position, target, typed, correct, total, tokens_correct}]``.
        """
        exercise = self.get_exercise(exercise_id)
        score = clamp_score(score)
        clean_lines = self._clean_lines(lines)
        if not clean_lines:
            raise ValidationError("Nothing to save — the dictation has no lines.")
        completed = is_complete(score)
        last_result = {"score": score, "lines": clean_lines, "at": timezone.now().isoformat()}
        progress = self._repo.record_attempt(user, exercise, score=score, completed=completed, last_result=last_result)
        return {"score": score, "completed": completed, "progress": progress}

    def save_progress(self, user, exercise_id, *, lines):
        """Auto-save the per-sentence answers checked so far.

        Unlike :meth:`submit_dictation` this never counts an attempt, changes the
        best score or marks the exercise complete — it only stores the current
        per-sentence breakdown so a long exercise can be resumed later. An empty
        ``lines`` list clears the saved answers.
        """
        exercise = self.get_exercise(exercise_id)
        clean_lines = self._clean_lines(lines)
        correct = sum(line["correct"] for line in clean_lines)
        total = sum(line["total"] for line in clean_lines)
        score = clamp_score(round(correct / total * 100)) if total else 0
        last_result = {"score": score, "lines": clean_lines, "at": timezone.now().isoformat()}
        return self._repo.save_partial_progress(user, exercise, last_result=last_result)

    def reset_progress(self, user, exercise_id):
        """Clear the saved per-sentence answers so the exercise starts fresh."""
        exercise = self.get_exercise(exercise_id)
        return self._repo.reset_progress(user, exercise)

    @staticmethod
    def _clean_lines(lines):
        return [
            {
                "position": int(line.get("position") or 0),
                "target": str(line.get("target") or ""),
                "typed": str(line.get("typed") or ""),
                "correct": int(line.get("correct") or 0),
                "total": int(line.get("total") or 0),
                "tokens_correct": [bool(x) for x in (line.get("tokens_correct") or [])],
            }
            for line in (lines or [])
            if isinstance(line, dict)
        ]

    def set_highlight(self, user, exercise_id, *, text, note="", remove=False):
        """Add, update or remove a per-user noted highlight on an exercise."""
        exercise = self.get_exercise(exercise_id)
        return self._repo.set_highlight(user, exercise, text=text, note=note, remove=remove)

    # ── Per-sentence translation & notes ──────────────────────────────────
    def translate_sentence(self, text, target_language="vi"):
        """Translate ``text`` to ``target_language`` (Google first, AI as backup).

        Returns ``{"translation", "provider"}``. Never raises for a translation
        miss — an empty translation with ``provider="none"`` is returned instead
        so the caller can prompt the user to type one manually.
        """
        text = (text or "").strip()
        if not text:
            raise ValidationError("Nothing to translate.")
        target_language = (target_language or "vi").strip() or "vi"
        if self._translator is not None:
            translation = (self._translator.translate(text, target_language=target_language) or "").strip()
            if translation:
                return {"translation": translation, "provider": self._translator.label}
        if self._ai is not None:
            translation = self._ai_translate(text, target_language)
            if translation:
                return {"translation": translation, "provider": "ai"}
        return {"translation": "", "provider": "none"}

    def _ai_translate(self, text, target_language):
        system = (
            "You are a professional translator. Translate the user's English sentence "
            "into the requested target language. Preserve meaning and tone; return only "
            'the translation as JSON {"translation": "..."}.'
        )
        user = f'Target language code: "{target_language}".\nSentence: "{text}"'
        schema = {"type": "object", "properties": {"translation": {"type": "string"}}}
        try:
            raw = self._ai.generate_json(system, user, schema)
        except Exception:  # noqa: BLE001 — best effort; caller handles the empty result
            logger.warning("AI translation fallback failed for %r", text[:48])
            return ""
        return str((raw or {}).get("translation") or "").strip()

    def set_sentence_meta(self, user, exercise_id, *, position, translation=None, note=None):
        """Persist a per-user, per-sentence translation and/or note."""
        exercise = self.get_exercise(exercise_id)
        if position is None:
            raise ValidationError("Missing sentence position.")
        return self._repo.set_sentence_meta(user, exercise, position=position, translation=translation, note=note)

    # ── Import (crawler) ──────────────────────────────────────────────────
    def import_topic(self, *, slug, defaults):
        return self._repo.upsert_topic(slug, defaults)

    def import_exercise(self, *, key, defaults):
        return self._repo.upsert_exercise(key, defaults)

    def clean_topics(self, slugs):
        """Delete the given topics' content before a fresh re-crawl. User progress
        survives (it is keyed on the stable exercise key)."""
        return self._repo.delete_topics(slugs)

    # ── Topic cover ────────────────────────────────────────────────────────
    def set_topic_cover_svg(self, slug, svg_markup):
        """Upload an SVG cover to Cloudinary and store its URL on the topic."""
        if self._image_storage is None:
            raise ValidationError("Image storage is not configured.")
        topic = self._repo.get_topic(slug)
        if topic is None:
            raise NotFoundError("Listening topic not found.")
        url = self._image_storage.upload_svg(svg_markup, f"flashlearn/listening/covers/{slug}")
        if not url:
            raise ValidationError("Cloudinary returned no URL for the cover.")
        self._repo.save_topic_background(topic, url)
        return url

    # ── Audio hosting ─────────────────────────────────────────────────────
    def exercises_for_topic_slug(self, slug):
        return list(self._repo.exercises_for_topic_slug(slug))

    def exercises_for_topic_slug_all(self):
        return list(self._repo.all_exercises())

    def mirror_exercise_audio(self, exercise, *, regenerate=False, on_progress=None):
        """Mirror each sentence's source recording to our CDN; TTS any that lack one.

        Idempotent: already-hosted sentences are skipped unless ``regenerate`` is
        set. Returns counts ``{mirrored, generated, skipped, failed}``.
        """
        mirrored = generated = skipped = failed = 0
        changed = False
        for sentence in exercise.sentences or []:
            if not regenerate and sentence.get("audio_hosted") and sentence.get("audio_url"):
                skipped += 1
                continue
            text = (sentence.get("text") or "").strip()
            source = (sentence.get("source_audio_url") or "").strip()
            hosted = ""
            if source:
                hosted = self._mirror_audio(source, self._sentence_public_id(exercise, sentence), invalidate=regenerate)
            if not hosted and text:
                hosted = self._tts_fallback(text)
                if hosted:
                    generated += 1
            elif hosted:
                mirrored += 1
            if hosted:
                sentence["audio_url"] = hosted
                sentence["audio_hosted"] = True
                changed = True
                if on_progress:
                    on_progress(f"{exercise.key} #{sentence.get('position')}: {text[:48]}")
            else:
                failed += 1
                if on_progress:
                    on_progress(f"FAILED {exercise.key} #{sentence.get('position')}: {text[:48]}")

        # Full-exercise audio: mirror once (kept as a source URL until then).
        full_source = (exercise.full_audio_url or "").strip()
        if full_source and (regenerate or not self._looks_hosted(full_source)):
            hosted_full = self._mirror_audio(
                full_source, self._sentence_public_id(exercise, {"position": "full"}), invalidate=regenerate
            )
            if hosted_full:
                exercise.full_audio_url = hosted_full
                changed = True

        if changed:
            self._repo.save_exercise_audio(exercise)
        return {"mirrored": mirrored, "generated": generated, "skipped": skipped, "failed": failed}

    # ── Internals ─────────────────────────────────────────────────────────
    @staticmethod
    def _sentence_public_id(exercise, sentence):
        return f"flashlearn/listening_audio/{exercise.key}/{sentence.get('position')}"

    @staticmethod
    def _looks_hosted(url):
        return "cloudinary" in (url or "")

    def _mirror_audio(self, source_url, public_id, *, invalidate=False):
        """Fetch ``source_url`` into our audio store; return the hosted URL (or "")."""
        if self._audio_storage is None or not source_url:
            return ""
        try:
            return self._audio_storage.mirror_url(source_url, public_id=public_id, invalidate=invalidate) or ""
        except Exception:  # noqa: BLE001 — never fail a batch on a single CDN hiccup
            logger.warning("Listening audio mirror failed for %s", source_url)
            return ""

    def _tts_fallback(self, text):
        """Synthesize ``text`` via the Speaking Coach TTS pipeline; return its URL (or "")."""
        if self._speaking is None:
            return ""
        try:
            clip = self._speaking.speak(text, None)
            return clip.audio_url or ""
        except Exception:  # noqa: BLE001 — best effort; browser TTS covers the rest
            logger.warning("Listening TTS fallback failed for %r", text[:48])
            return ""

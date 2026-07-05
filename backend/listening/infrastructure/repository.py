"""Persistence for the Listening (dictation) feature.

All Django ORM access for topics, exercises and per-user dictation progress lives
here so the application service and the DRF viewset never touch the ORM directly.
Per-sentence audio is cached in the shared :class:`SpeakingAudioClip` table (the
TTS fallback path), the same store the Speaking Coach and Courses use.
"""

from django.utils import timezone

from backend.models import (
    ListeningExercise,
    ListeningProgress,
    ListeningTopic,
    SpeakingAudioClip,
)


class ListeningRepository:
    # ── Catalog reads ─────────────────────────────────────────────────────
    @staticmethod
    def list_topics():
        return ListeningTopic.objects.all()

    @staticmethod
    def get_topic(slug):
        return ListeningTopic.objects.filter(slug=slug).first()

    @staticmethod
    def exercises_for_topic(topic):
        return topic.exercises.order_by("order")

    @staticmethod
    def exercise_ids_for_topic(topic):
        return list(ListeningExercise.objects.filter(topic=topic).values_list("id", flat=True))

    @staticmethod
    def get_exercise(exercise_id):
        return ListeningExercise.objects.filter(id=exercise_id).select_related("topic").first()

    @staticmethod
    def exercises_for_topic_slug(slug):
        """Every exercise of a topic in order (used by the audio-collection command)."""
        return ListeningExercise.objects.filter(topic__slug=slug).select_related("topic").order_by("order")

    @staticmethod
    def all_exercises():
        return ListeningExercise.objects.select_related("topic").order_by("topic__order", "order")

    # ── Shared TTS audio cache (fallback path) ────────────────────────────
    @staticmethod
    def clip_hash(text):
        return SpeakingAudioClip.hash_text(text)

    @staticmethod
    def get_clip(voice, text_hash):
        return SpeakingAudioClip.objects.filter(voice=voice, text_hash=text_hash).first()

    @staticmethod
    def save_exercise_audio(exercise):
        exercise.save(update_fields=["sentences", "full_audio_url", "updated_at"])

    # ── Topic cover ───────────────────────────────────────────────────────
    @staticmethod
    def save_topic_background(topic, background):
        topic.background = background
        topic.save(update_fields=["background", "updated_at"])
        return topic

    # ── Progress (keyed on the exercise's stable natural key) ─────────────
    @staticmethod
    def get_progress(user, exercise):
        return ListeningProgress.objects.filter(user=user, exercise_key=exercise.key).first()

    @staticmethod
    def progress_for_topic(user, topic):
        """``{exercise_key: progress}`` for every exercise of ``topic`` the user touched."""
        rows = ListeningProgress.objects.filter(user=user, exercise_key__startswith=f"{topic.slug}/")
        return {row.exercise_key: row for row in rows}

    @staticmethod
    def record_attempt(user, exercise, *, score, completed, last_result=None):
        """Upsert progress for an attempt, keeping the best score and completion state."""
        progress, _ = ListeningProgress.objects.get_or_create(user=user, exercise_key=exercise.key)
        progress.attempts += 1
        if score > progress.best_score:
            progress.best_score = score
        if completed and progress.status != ListeningProgress.STATUS_COMPLETED:
            progress.status = ListeningProgress.STATUS_COMPLETED
            progress.completed_at = timezone.now()
        if last_result is not None:
            progress.last_result = last_result
        progress.save()
        return progress

    @staticmethod
    def save_partial_progress(user, exercise, *, last_result):
        """Persist an in-progress (per-sentence) attempt without touching the
        best score, attempt count or completion state — used to auto-save so a
        long exercise can be finished across several sessions."""
        progress, _ = ListeningProgress.objects.get_or_create(user=user, exercise_key=exercise.key)
        progress.last_result = last_result
        progress.save(update_fields=["last_result", "updated_at"])
        return progress

    @staticmethod
    def reset_progress(user, exercise):
        """Clear the saved per-sentence answers for an exercise (keep best_score)."""
        progress = ListeningProgress.objects.filter(user=user, exercise_key=exercise.key).first()
        if progress is None:
            return None
        progress.last_result = {}
        progress.status = ListeningProgress.STATUS_IN_PROGRESS
        progress.completed_at = None
        progress.save(update_fields=["last_result", "status", "completed_at", "updated_at"])
        return progress

    @staticmethod
    def set_highlight(user, exercise, *, text, note="", remove=False):
        """Add, update or remove a noted word/phrase on an exercise (per user)."""
        progress, _ = ListeningProgress.objects.get_or_create(user=user, exercise_key=exercise.key)
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

    @staticmethod
    def set_sentence_meta(user, exercise, *, position, translation=None, note=None):
        """Upsert per-sentence translation/note for a user (keyed by position).

        Only the provided fields are written; ``None`` leaves the existing value
        untouched. Returns the full ``sentence_meta`` dict."""
        progress, _ = ListeningProgress.objects.get_or_create(user=user, exercise_key=exercise.key)
        meta = dict(progress.sentence_meta or {})
        key = str(position)
        entry = dict(meta.get(key) or {})
        if translation is not None:
            entry["translation"] = translation
        if note is not None:
            entry["note"] = note
        # Drop empty entries so the payload stays lean.
        if not (entry.get("translation") or entry.get("note")):
            meta.pop(key, None)
        else:
            meta[key] = entry
        progress.sentence_meta = meta
        progress.save(update_fields=["sentence_meta", "updated_at"])
        return meta

    # ── Importer upserts (used by the crawler) ────────────────────────────
    @staticmethod
    def upsert_topic(slug, defaults):
        topic, _ = ListeningTopic.objects.update_or_create(slug=slug, defaults=defaults)
        return topic

    @staticmethod
    def upsert_exercise(key, defaults):
        """Upsert an exercise by its stable global key, preserving the row across re-crawls."""
        exercise, _ = ListeningExercise.objects.update_or_create(key=key, defaults=defaults)
        return exercise

    @staticmethod
    def delete_topics(slugs):
        """Delete topics (cascading exercises). Progress is untouched because it is
        keyed on ``exercise_key``, not an exercise FK."""
        return ListeningTopic.objects.filter(slug__in=list(slugs)).delete()

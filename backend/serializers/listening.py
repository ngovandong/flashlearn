from rest_framework import serializers

from ..models import ListeningExercise, ListeningTopic


def _progress_payload(progress):
    if progress is None:
        return {
            "status": "not_started",
            "best_score": 0,
            "attempts": 0,
            "last_result": {},
            "highlights": [],
            "sentence_meta": {},
        }
    return {
        "status": progress.status,
        "best_score": progress.best_score,
        "attempts": progress.attempts,
        "completed_at": progress.completed_at,
        "last_result": progress.last_result or {},
        "highlights": progress.highlights or [],
        "sentence_meta": progress.sentence_meta or {},
    }


def _public_sentence(sentence):
    """Trim internal bookkeeping (source URL / hosted flag) from a sentence."""
    audio_url = (sentence.get("audio_url") or "").strip() or (sentence.get("source_audio_url") or "").strip()
    return {
        "position": sentence.get("position"),
        "text": sentence.get("text") or "",
        "tokens": sentence.get("tokens") or [],
        "audio_url": audio_url,
        "time_start": sentence.get("time_start"),
        "time_end": sentence.get("time_end"),
        "hint": sentence.get("hint"),
        "explanation": sentence.get("explanation"),
    }


class ListeningExerciseSummarySerializer(serializers.Serializer):
    """Catalog row for a topic's exercise list (no sentences)."""

    def to_representation(self, exercise):
        progress = (self.context.get("progress") or {}).get(exercise.key)
        sentences = exercise.sentences or []
        return {
            "id": exercise.id,
            "slug": exercise.slug,
            "key": exercise.key,
            "title": exercise.title,
            "level": exercise.level,
            "order": exercise.order,
            "sentence_count": len(sentences),
            "has_audio": any((s or {}).get("audio_url") or (s or {}).get("source_audio_url") for s in sentences),
            "progress": _progress_payload(progress),
        }


class ListeningTopicSummarySerializer(serializers.Serializer):
    """Catalog row: a topic plus the user's completed/total exercise counts."""

    id = serializers.UUIDField(source="topic.id")
    slug = serializers.CharField(source="topic.slug")
    title = serializers.CharField(source="topic.title")
    level = serializers.CharField(source="topic.level")
    description = serializers.CharField(source="topic.description")
    background = serializers.CharField(source="topic.background")
    order = serializers.IntegerField(source="topic.order")
    total_exercises = serializers.IntegerField()
    completed_exercises = serializers.IntegerField()


class ListeningTopicDetailSerializer(serializers.ModelSerializer):
    exercises = serializers.SerializerMethodField()

    class Meta:
        model = ListeningTopic
        fields = ["id", "slug", "title", "level", "description", "background", "order", "exercises"]

    def get_exercises(self, topic):
        exercises = self.context.get("exercises") or []
        return ListeningExerciseSummarySerializer(exercises, many=True, context=self.context).data


class ListeningExerciseSerializer(serializers.ModelSerializer):
    topic = serializers.SerializerMethodField()
    sentences = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    prev_id = serializers.SerializerMethodField()
    next_id = serializers.SerializerMethodField()

    class Meta:
        model = ListeningExercise
        fields = [
            "id",
            "slug",
            "key",
            "title",
            "level",
            "order",
            "full_audio_url",
            "topic",
            "sentences",
            "progress",
            "prev_id",
            "next_id",
        ]

    def get_topic(self, exercise):
        return {"slug": exercise.topic.slug, "title": exercise.topic.title, "level": exercise.topic.level}

    def get_sentences(self, exercise):
        return [_public_sentence(s) for s in (exercise.sentences or []) if isinstance(s, dict)]

    def get_progress(self, exercise):
        return _progress_payload(self.context.get("progress"))

    def get_prev_id(self, exercise):
        return self.context.get("prev_id")

    def get_next_id(self, exercise):
        return self.context.get("next_id")

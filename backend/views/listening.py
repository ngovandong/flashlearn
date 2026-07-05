from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..serializers.listening import (
    ListeningExerciseSerializer,
    ListeningTopicDetailSerializer,
    ListeningTopicSummarySerializer,
)
from ..services import listening_service


class ListeningViewSet(viewsets.ViewSet):
    """Dictation (listen-and-type) topics, exercises and progress.

    Thin transport layer — parsing, serialization and error mapping only. All
    rules and data access live in :class:`ListeningService` and its repository.
    """

    permission_classes = (permissions.IsAuthenticated,)
    lookup_value_regex = "[^/]+"

    @action(detail=False, methods=["GET"])
    def topics(self, request, *args, **kwargs):
        """Catalog: every topic with the user's completed/total exercise counts."""
        summaries = listening_service.catalog(request.user)
        return Response(ListeningTopicSummarySerializer(summaries, many=True).data)

    def retrieve(self, request, pk=None, *args, **kwargs):
        """Topic detail (by slug): its exercises + the user's per-exercise progress."""
        detail = listening_service.topic_detail(request.user, pk)
        serializer = ListeningTopicDetailSerializer(
            detail["topic"],
            context={"exercises": detail["exercises"], "progress": detail["progress"]},
        )
        return Response(serializer.data)

    @action(detail=False, methods=["GET"])
    def exercise(self, request, *args, **kwargs):
        """One exercise's sentences + audio + the user's progress (``?id=<uuid>``)."""
        detail = listening_service.exercise_detail(request.user, request.query_params.get("id"))
        serializer = ListeningExerciseSerializer(
            detail["exercise"],
            context={
                "progress": detail["progress"],
                "prev_id": detail["prev_id"],
                "next_id": detail["next_id"],
            },
        )
        return Response(serializer.data)

    @action(detail=False, methods=["POST"])
    def submit(self, request, *args, **kwargs):
        """Save a listen-and-type attempt so it replays on revisit.

        Body: ``{exercise_id, score, lines: [{position, target, typed, correct,
        total, tokens_correct}]}``. The typed text is scored client-side (a
        word-level diff); this persists the breakdown and updates completion.
        """
        exercise_id = request.data.get("exercise_id")
        if not exercise_id:
            return Response({"errors": "Missing exercise."}, status=status.HTTP_400_BAD_REQUEST)
        outcome = listening_service.submit_dictation(
            request.user,
            exercise_id,
            score=request.data.get("score"),
            lines=request.data.get("lines"),
        )
        progress = outcome["progress"]
        return Response(
            {
                "score": outcome["score"],
                "completed": outcome["completed"],
                "progress": {
                    "status": progress.status,
                    "best_score": progress.best_score,
                    "attempts": progress.attempts,
                    "completed_at": progress.completed_at,
                },
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["POST"])
    def save_progress(self, request, *args, **kwargs):
        """Auto-save the per-sentence answers checked so far (no attempt/scoring).

        Body: ``{exercise_id, lines: [...]}``. Lets a long dictation be resumed
        across sessions; an empty ``lines`` list clears the saved answers.
        """
        exercise_id = request.data.get("exercise_id")
        if not exercise_id:
            return Response({"errors": "Missing exercise."}, status=status.HTTP_400_BAD_REQUEST)
        listening_service.save_progress(request.user, exercise_id, lines=request.data.get("lines"))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["POST"])
    def reset_progress(self, request, *args, **kwargs):
        """Clear the saved per-sentence answers so the exercise starts fresh."""
        exercise_id = request.data.get("exercise_id")
        if not exercise_id:
            return Response({"errors": "Missing exercise."}, status=status.HTTP_400_BAD_REQUEST)
        listening_service.reset_progress(request.user, exercise_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["POST"])
    def highlight(self, request, *args, **kwargs):
        """Add, update or remove a per-user noted word/phrase on an exercise."""
        exercise_id = request.data.get("exercise_id")
        text = (request.data.get("text") or "").strip()
        if not exercise_id:
            return Response({"errors": "Missing exercise."}, status=status.HTTP_400_BAD_REQUEST)
        if not text:
            return Response({"errors": "Please enter some text."}, status=status.HTTP_400_BAD_REQUEST)
        highlights = listening_service.set_highlight(
            request.user,
            exercise_id,
            text=text,
            note=(request.data.get("note") or "").strip(),
            remove=bool(request.data.get("remove")),
        )
        return Response({"highlights": highlights})

    @action(detail=False, methods=["POST"])
    def translate(self, request, *args, **kwargs):
        """Translate a sentence to the user's language (Google, AI backup).

        Body: ``{text, target_language?}`` → ``{translation, provider}``. This
        does not persist anything; the user saves an (optionally edited)
        translation via :meth:`sentence_meta`.
        """
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"errors": "Nothing to translate."}, status=status.HTTP_400_BAD_REQUEST)
        result = listening_service.translate_sentence(
            text, target_language=(request.data.get("target_language") or "vi")
        )
        return Response(result)

    @action(detail=False, methods=["POST"])
    def sentence_meta(self, request, *args, **kwargs):
        """Save a per-user, per-sentence translation and/or note.

        Body: ``{exercise_id, position, translation?, note?}``. Only the provided
        fields are written. Returns the full ``{sentence_meta}`` map.
        """
        exercise_id = request.data.get("exercise_id")
        position = request.data.get("position")
        if not exercise_id:
            return Response({"errors": "Missing exercise."}, status=status.HTTP_400_BAD_REQUEST)
        if position is None:
            return Response({"errors": "Missing sentence position."}, status=status.HTTP_400_BAD_REQUEST)
        translation = request.data.get("translation")
        note = request.data.get("note")
        meta = listening_service.set_sentence_meta(
            request.user,
            exercise_id,
            position=position,
            translation=None if translation is None else str(translation).strip(),
            note=None if note is None else str(note).strip(),
        )
        return Response({"sentence_meta": meta})

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..serializers.grammar import GrammarCatalogSerializer, GrammarUnitDetailSerializer
from ..services import grammar_coach_service, grammar_service
from ..shared.application.exceptions import DomainError
from ..shared.infrastructure.ai import AiProviderError


class GrammarViewSet(viewsets.ViewSet):
    """Grammar textbook units, server-graded exercises and progress.

    Thin transport layer — parsing, serialization and error mapping only. All
    rules, grading and data access live in :class:`GrammarService` (application)
    and its repository; the AI "explain" option lives in
    :class:`GrammarCoachService`.
    """

    permission_classes = (permissions.IsAuthenticated,)
    lookup_value_regex = "[^/]+"

    def list(self, request, *args, **kwargs):
        """Catalog: a book's sections → units with the user's progress counts.

        ``?book=<slug>`` selects the book (defaults to the first).
        """
        catalog = grammar_service.catalog(request.user, request.query_params.get("book"))
        if catalog is None:
            return Response({"book": None, "sections": []})
        return Response(GrammarCatalogSerializer(catalog).data)

    @action(detail=False, methods=["GET"])
    def books(self, request, *args, **kwargs):
        """Every imported book with the user's unit-completion summary (for the
        book selector / filter on the Grammar and Course tabs)."""
        return Response({"books": grammar_service.list_books(request.user)})

    def retrieve(self, request, pk=None, *args, **kwargs):
        """Unit detail (by unit key): explanation + answer-stripped exercises."""
        try:
            detail = grammar_service.unit_detail(request.user, pk)
        except DomainError as exc:
            return Response({"errors": exc.message}, status=exc.default_status)
        return Response(GrammarUnitDetailSerializer(detail).data)

    @action(detail=False, methods=["POST"])
    def submit_exercise(self, request, *args, **kwargs):
        """Grade a submitted attempt server-side and update progress.

        Body: ``{exercise_key, submissions: [[<typed per blank>], ...]}``.
        Returns ``{score, completed, results, progress}`` where ``results`` reveal
        the canonical answers so the client can show what was right/wrong.
        """
        exercise_key = request.data.get("exercise_key")
        if not exercise_key:
            return Response({"errors": "Missing exercise."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            outcome = grammar_service.submit_exercise(request.user, exercise_key, request.data.get("submissions"))
        except DomainError as exc:
            return Response({"errors": exc.message}, status=exc.default_status)
        ex_progress = outcome["exercise_progress"]
        unit_progress = outcome["unit_progress"]
        return Response(
            {
                "score": outcome["score"],
                "completed": outcome["completed"],
                "results": outcome["results"],
                "progress": {
                    "status": ex_progress.status,
                    "best_score": ex_progress.best_score,
                    "attempts": ex_progress.attempts,
                },
                "unit_progress": {
                    "status": unit_progress.status,
                    "best_score": unit_progress.best_score,
                },
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["POST"])
    def clear_progress(self, request, *args, **kwargs):
        """Reset the user's practice results for a whole unit (highlights kept).

        Body: ``{unit_key}``. Returns ``{cleared}`` — how many exercise attempts
        were removed.
        """
        unit_key = request.data.get("unit_key")
        if not unit_key:
            return Response({"errors": "Missing unit."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cleared = grammar_service.clear_unit_results(request.user, unit_key)
        except DomainError as exc:
            return Response({"errors": exc.message}, status=exc.default_status)
        return Response({"cleared": cleared})

    @action(detail=False, methods=["POST"])
    def explain(self, request, *args, **kwargs):
        """AI "explain" option: explain a rule, or why an answer is wrong.

        Body: any of ``{question, unit_title, sentence, given, correct}``.
        """
        data = request.data
        if not any(data.get(k) for k in ("question", "unit_title", "sentence", "given", "correct")):
            return Response({"errors": "Nothing to explain."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = grammar_coach_service.explain(
                question=(data.get("question") or "").strip(),
                unit_title=(data.get("unit_title") or "").strip(),
                sentence=(data.get("sentence") or "").strip(),
                given=(data.get("given") or "").strip(),
                correct=(data.get("correct") or "").strip(),
            )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)

    @action(detail=False, methods=["POST"])
    def highlight(self, request, *args, **kwargs):
        """Add, update or remove a per-user noted word/phrase on a unit."""
        unit_key = request.data.get("unit_key")
        text = (request.data.get("text") or "").strip()
        if not unit_key:
            return Response({"errors": "Missing unit."}, status=status.HTTP_400_BAD_REQUEST)
        if not text:
            return Response({"errors": "Please enter some text."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            highlights = grammar_service.set_highlight(
                request.user,
                unit_key,
                text=text,
                note=(request.data.get("note") or "").strip(),
                remove=bool(request.data.get("remove")),
            )
        except DomainError as exc:
            return Response({"errors": exc.message}, status=exc.default_status)
        return Response({"highlights": highlights})

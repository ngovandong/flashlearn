from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..serializers.revise import ReviseCardSerializer
from ..services import revise_service
from ..shared.application.exceptions import DomainError
from ..shared.infrastructure.ai import AiProviderError


class ReviseViewSet(viewsets.ViewSet):
    """Mixed "Revise" session: past mistakes across every feature, hardest first.

    Thin transport layer — the scheduling, cross-feature gathering, grading and
    write-back all live in :class:`ReviseService` (application) and its
    repository.
    """

    permission_classes = (permissions.IsAuthenticated,)

    @action(detail=False, methods=["POST"])
    def session(self, request, *args, **kwargs):
        """Build a fresh session (answer-free cards ready to play).

        Body (optional): ``{size}``. Returns ``{cards: [...], counts: {kind: n}}``.
        """
        try:
            size = int(request.data.get("size") or 12)
        except (TypeError, ValueError):
            size = 12
        result = revise_service.build_session(request.user, size=size)
        return Response(
            {
                "cards": ReviseCardSerializer(result["cards"], many=True).data,
                "counts": result["counts"],
            }
        )

    @action(detail=False, methods=["POST"])
    def answer(self, request, *args, **kwargs):
        """Grade one answer and update the card.

        Body: ``{card_id, given?, audio?, mime_type?}`` — ``given`` is the typed
        text / chosen option (or a list of blanks for grammar); ``audio`` is
        base64 audio for speaking cards. Returns ``{correct, answer, mastered,
        ...}``.
        """
        card_id = request.data.get("card_id")
        if not card_id:
            return Response({"errors": "Missing card."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            outcome = revise_service.grade_answer(
                request.user,
                card_id,
                given=request.data.get("given"),
                audio=request.data.get("audio"),
                mime_type=request.data.get("mime_type"),
            )
        except DomainError as exc:
            return Response({"errors": exc.message}, status=exc.default_status)
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(outcome, status=status.HTTP_201_CREATED)

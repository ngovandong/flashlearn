from django.http import Http404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..serializers.competition import (
    CompetitionPoolSerializer,
    LeaderboardSerializer,
    SubmitScoreSerializer,
)
from ..services import competition_service
from ..shared.application.exceptions import DomainError


class CompetitionViewSet(viewsets.ViewSet):
    """Deck-scoped mini-games. Thin transport layer — the pool sampling,
    scoring and leaderboard ranking live in :class:`CompetitionService`."""

    permission_classes = (permissions.IsAuthenticated,)

    @action(detail=False, methods=["GET"])
    def pool(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id")
        if not deck_id:
            raise Http404("Please select a deck.")
        try:
            data = competition_service.get_pool(request.user, deck_id)
        except DomainError as exc:
            return Response({"errors": exc.message}, status=exc.default_status)
        return Response(CompetitionPoolSerializer(data).data)

    @action(detail=False, methods=["GET"])
    def leaderboard(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id")
        game_key = request.query_params.get("game_key")
        if not deck_id or not game_key:
            raise Http404("Please select a deck and game.")
        try:
            data = competition_service.get_leaderboard(request.user, deck_id, game_key)
        except DomainError as exc:
            return Response({"errors": exc.message}, status=exc.default_status)
        return Response(LeaderboardSerializer(data).data)

    @action(detail=False, methods=["POST"])
    def submit_score(self, request, *args, **kwargs):
        serializer = SubmitScoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        try:
            result = competition_service.submit_score(
                request.user,
                payload["deck_id"],
                payload["game_key"],
                payload["score"],
            )
        except DomainError as exc:
            return Response({"errors": exc.message}, status=exc.default_status)
        return Response(result, status=status.HTTP_201_CREATED)

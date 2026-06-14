from django.http import Http404
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from backend.shared.interfaces.viewsets import FlexibleViewSet

from ..models import UserLearningProgress
from ..permissions import EditableLearningProgress
from ..serializers import (
    CreateLearningProgressSerializer,
    ReviseTermSerializer,
    TermSerializer,
    UserLearningProgressSerializer,
)
from ..services import learning_service, term_service


class LearningViewSet(FlexibleViewSet):
    serializer_class = UserLearningProgressSerializer
    queryset = UserLearningProgress.objects.all()

    permission_classes = [IsAuthenticated]

    editable_learning_progress = (IsAuthenticated, EditableLearningProgress)

    permission_map = {
        "correct": editable_learning_progress,
        "incorrect": editable_learning_progress,
        "remember": editable_learning_progress,
    }

    serializer_map = {
        "get_learning_terms": TermSerializer,
        "get_revise_terms": ReviseTermSerializer,
        "create": CreateLearningProgressSerializer,
    }

    def perform_create(self, serializer):
        term_id = serializer.validated_data.get("term_id")
        user_id = serializer.validated_data.get("user_id")
        learning_service.create_or_touch_progress(self.request.user, term_id, user_id)

    def create(self, request, *args, **kwargs):
        data = dict(request.data)
        data["user_id"] = request.user.id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["PUT"])
    def correct(self, request, *args, **kwargs):
        learning_service.record_correct(self.get_object(), request.user)
        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=["PUT"])
    def incorrect(self, request, *args, **kwargs):
        learning_service.record_incorrect(self.get_object(), request.user)
        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=["PUT"])
    def remember(self, request, *args, **kwargs):
        learning_service.toggle_remember(self.get_object())
        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=["PUT"])
    def priority(self, request, *args, **kwargs):
        adjust_point = int(request.data.get("adjust_point", 0))
        learning_service.adjust_priority(self.get_object(), adjust_point)
        return Response(status=status.HTTP_200_OK)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter("deck_id", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by deck")
        ]
    )
    @action(detail=False, methods=["GET"])
    def get_learning_terms(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id")
        if deck_id is None:
            raise Http404("deck_id parameter is required")
        deck_terms = term_service.get_learning_terms_for_deck(deck_id, request.user)
        queryset = self.filter_queryset(deck_terms)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter("deck_id", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Get by deck"),
            openapi.Parameter(
                "term_id",
                openapi.IN_QUERY,
                type=openapi.TYPE_STRING,
                description="Open the deck at this specific term instead of the last-learned one",
            ),
        ]
    )
    @action(detail=False, methods=["GET"])
    def get_latest_learned_term(self, request, *args, **kwargs):
        from django.conf import settings

        deck_id = request.query_params.get("deck_id")
        if deck_id is None:
            raise Http404("deck_id parameter is required")
        term_id = request.query_params.get("term_id") or None
        page_size = settings.REST_FRAMEWORK.get("PAGE_SIZE", 10)
        return Response(learning_service.get_latest_learned_term_info(request.user, deck_id, page_size, term_id))

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter("deck_id", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by deck")
        ]
    )
    @action(detail=False, methods=["GET"])
    def get_revise_terms(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id", None)
        if deck_id is None:
            raise Http404("deck_id parameter is required")
        data = term_service.get_revise_terms(request.user, deck_id)
        serializer = self.get_serializer(data)
        return Response(serializer.data)

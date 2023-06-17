from rest_framework import status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from base.views import FlexibleViewSet
from django.utils import timezone
from django.http import Http404
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from ..serializers import LearningTermSerializer, CreateLearningProgressSerializer, ReviseTermSerializer, UserLearningProgressSerializer
from ..models import Term, UserLearningProgress
from ..services import TermService
from ..permissions import EditableDeck, IsOwnerPermission


class LearningViewSet(FlexibleViewSet):
    serializer_class = UserLearningProgressSerializer
    pagination_class = None
    queryset = UserLearningProgress.objects.all()

    permission_classes = (permissions.IsAuthenticated)

    permission_map = {}

    serializer_map = {
        "get_learning_terms": LearningTermSerializer,
        "get_revise_terms": ReviseTermSerializer,
        "create": CreateLearningProgressSerializer,
    }

    def perform_create(self, serializer):
        term_id = serializer.validated_data.get("term_id")
        instance = self.get_queryset().filter(
            user=self.request.user, term_id=term_id).first()
        if instance is None:
            serializer.save()
        else:
            instance.last_learned_at = timezone.now()
            instance.save()

    def create(self, request, *args, **kwargs):
        data = request.data
        data['user_id'] = request.user.id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["PUT"])
    def correct(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.score += 2
        instance.save()

        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=["PUT"])
    def incorrect(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.score -= 3
        instance.save()

        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=["PUT"])
    def remember(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_skip = not instance.is_skip
        instance.save()

        return Response(status=status.HTTP_200_OK)

    @swagger_auto_schema(manual_parameters=[
        openapi.Parameter('deck_id', openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by deck")])
    @action(detail=False, methods=["GET"], )
    def get_learning_terms(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id", None)
        if deck_id is None:
            raise Http404("deck_id parameter is required")
        deck_terms = Term.objects.get_terms_for_deck(deck_id=deck_id).all()
        last_learned_term = Term.objects.get_last_learned_term(
            request.user, deck_id)

        if last_learned_term:
            last_learned_index = last_learned_term.id
            for index, t in enumerate(deck_terms):
                if t.id == last_learned_term.id:
                    last_learned_index = index

        else:
            last_learned_index = 0

        instance = {"terms": deck_terms, "last_learned_index": last_learned_index
                    }
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @swagger_auto_schema(manual_parameters=[
        openapi.Parameter('deck_id', openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by deck")])
    @action(detail=False, methods=["GET"], )
    def get_revise_terms(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id", None)
        if deck_id is None:
            raise Http404("deck_id parameter is required")
        data = TermService.get_revise_terms(request.user, deck_id)
        serializer = self.get_serializer(data)
        return Response(serializer.data)

from rest_framework import status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from base.views import FlexibleViewSet
from django.utils import timezone
from django.http import Http404
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from ..serializers import TermSerializer, CreateLearningProgressSerializer, ReviseTermSerializer, UserLearningProgressSerializer
from ..models import Term, UserLearningProgress
from ..services import TermService, learning_progress_cache
from ..permissions import EditableDeck, IsOwnerPermission


class LearningViewSet(FlexibleViewSet):
    serializer_class = UserLearningProgressSerializer
    queryset = UserLearningProgress.objects.all()

    # permission_classes = (permissions.IsAuthenticated)

    permission_map = {}

    serializer_map = {
        "get_learning_terms": TermSerializer,
        "get_revise_terms": ReviseTermSerializer,
        "create": CreateLearningProgressSerializer,
    }

    def perform_create(self, serializer):
        term_id = serializer.validated_data.get("term_id")
        instance = self.get_queryset().filter(
            user=self.request.user, term_id=term_id).first()
        if instance is None:
            learning_progress = serializer.save()
            term = Term.objects.get(id=term_id)
            learning_progress_cache.delete_combine(
                term.deck_id, learning_progress.user_id)
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
        instance.last_revised_at = timezone.now()
        instance.save()
        # if instance.score == 5 or instance.score == 6:
        instance.term.deck_id
        learning_progress_cache.delete_combine(
            instance.term.deck_id, request.user.id)

        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=["PUT"])
    def incorrect(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.score -= 3
        instance.last_revised_at = timezone.now()
        instance.save()
        # if instance.score in [2, 3, 4]:
        instance.term.deck_id
        learning_progress_cache.delete_combine(
            instance.term.deck_id, request.user.id)

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
        deck_id = request.query_params.get("deck_id")
        if deck_id is None:
            raise Http404("deck_id parameter is required")
        deck_terms = Term.objects.get_terms_for_deck(deck_id=deck_id).all()
        queryset = self.filter_queryset(deck_terms)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @swagger_auto_schema(manual_parameters=[
        openapi.Parameter('deck_id', openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Get by deck")])
    @action(detail=False, methods=["GET"], )
    def get_latest_learned_term(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id")
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
            default_page = last_learned_index // settings.REST_FRAMEWORK.get(
                "PAGE_SIZE", 10) + 1
            res_dict = {"default_page": default_page,
                        "latest_id": last_learned_term.id,
                        "last_learned_index": last_learned_index
                        }
            return Response(res_dict)
        else:
            res_dict = {"default_page": 1,
                        "latest_id": "",
                        "last_learned_index": 0,
                        }
            return Response(res_dict)

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

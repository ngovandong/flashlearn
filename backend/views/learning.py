from urllib.parse import urlencode
from rest_framework import viewsets, status, permissions, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from base.views import FlexibleViewSet
from django.db.models import Q
from django.utils import timezone
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from ..serializers import TermSerializer, LearningTermSerializer, CreateLearningProgressSerializer
from ..models import Deck, Term, UserLearningProgress
from ..permissions import EditableDeck, IsOwnerPermission


class LearningViewSet(FlexibleViewSet):
    serializer_class = LearningTermSerializer
    pagination_class = None
    queryset = UserLearningProgress.objects.all()

    permission_classes = (permissions.IsAuthenticated)

    permission_map = {

    }

    serializer_map = {
        "get_learning_terms": LearningTermSerializer,
        "create": CreateLearningProgressSerializer
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

    @swagger_auto_schema(manual_parameters=[
        openapi.Parameter('deck_id', openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by deck")])
    @action(detail=False, methods=["GET"], )
    def get_learning_terms(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id")
        deck_terms = Term.objects.filter(deck_id=deck_id)
        learned_terms = Term.objects.filter(
            Q(learning_progress__user=request.user) & Q(deck_id=deck_id)).order_by('learning_progress__last_learned_at')
        last_learned_term = learned_terms.last()

        if last_learned_term:
            last_learned_index = last_learned_term.id
            for index, t in enumerate(deck_terms.all()):
                if t.id == last_learned_term.id:
                    last_learned_index = index

        else:
            last_learned_index = 1

        instance = {"terms": deck_terms, "last_learned_index": last_learned_index
                    }
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

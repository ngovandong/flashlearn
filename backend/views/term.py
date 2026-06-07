from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response

from backend.shared.interfaces.viewsets import FlexibleViewSet, SearchViewSet
from backend.term.infrastructure.search import TermSearchQuery

from ..documents import TermDocument
from ..models import Deck, Term
from ..permissions import EditableTerm
from ..serializers import AddTermsToDeckSerializer, TermNestInDeckSerializer, TermSerializer
from ..services import TermService


class LatestlCursorPagination(CursorPagination):
    ordering = "-created_at"


class TermViewSet(viewsets.ModelViewSet, FlexibleViewSet, SearchViewSet):
    serializer_class = TermSerializer
    queryset = Term.objects.all()

    pagination_class = LatestlCursorPagination
    document_class = TermDocument

    permission_classes = (permissions.IsAuthenticated, EditableTerm)
    serializer_map = {"add_terms": AddTermsToDeckSerializer, "list": TermNestInDeckSerializer}

    def generate_q_expression(self, query, **kwargs):
        return TermSearchQuery.build(query, kwargs.get("deck_id"))

    def perform_create(self, serializer):
        term = serializer.save()
        TermService.invalidate_learning_cache(term.deck_id, self.request.user.id)

    def perform_destroy(self, instance):
        TermService.invalidate_learning_cache(instance.deck_id, self.request.user.id)
        instance.delete()

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter("deck_id", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by deck"),
            openapi.Parameter(
                "query", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Search by term name, desc, deck name"
            ),
        ]
    )
    @action(detail=False, methods=["GET"])
    def search(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id", "")
        query = request.query_params.get("query", "")
        results = self.get_search_results(query, deck_id=deck_id)
        return Response(results)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter("deck_id", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by deck")
        ]
    )
    def list(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id", "")
        queryset = self.filter_queryset(self.get_queryset().filter(deck_id=deck_id))
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        data = dict(request.data)
        deck_id = data.get("deck")
        if not deck_id:
            return Response({"errors": "deck is required"}, status=status.HTTP_400_BAD_REQUEST)
        deck = Deck.objects.filter(pk=deck_id).first()
        if "image" in request.FILES:
            data["image"] = request.FILES["image"]
        term = TermService.create_term(deck, request.user, data)
        TermService.invalidate_learning_cache(term.deck_id, request.user.id)
        serializer = self.get_serializer(term)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["POST"])
    def add_to_default_deck(self, request, *args, **kwargs):
        term = TermService.add_to_default_deck(request.user, dict(request.data))
        TermService.invalidate_learning_cache(term.deck_id, request.user.id)
        serializer = self.get_serializer(term)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["POST"])
    def add_terms(self, request, *args, **kwargs):
        parsed = TermService.parse_add_terms_payload(request.data)
        deck_id = parsed.get("deck_id")
        if not deck_id:
            return Response({"errors": "deck_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        deck = Deck.objects.filter(pk=deck_id).first()
        TermService.add_terms(deck, request.user, parsed["terms"])
        TermService.invalidate_learning_cache(deck_id, request.user.id)
        return Response({"message": "Terms created successfully"})

    @action(detail=False, methods=["PUT"])
    def update_terms(self, request, *args, **kwargs):
        parsed_data = TermService.parse_multipart_terms(request.data)
        TermService.bulk_update_terms(parsed_data)
        return Response({"message": "Terms updated successfully"})

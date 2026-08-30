from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response

from backend.shared.interfaces.pagination import TermPageNumberPagination
from backend.shared.interfaces.viewsets import FlexibleViewSet, SearchViewSet
from backend.term.infrastructure.search import TermSearchQuery

from ..documents import TermDocument
from ..models import AiResponseCache, Term
from ..permissions import EditableTerm
from ..serializers import AddTermsToDeckSerializer, TermNestInDeckSerializer, TermSerializer
from ..services import deck_service, term_enrichment_service, term_service
from ..shared.infrastructure.ai import AiProviderError


class LatestlCursorPagination(CursorPagination):
    ordering = "-created_at"


class TermViewSet(viewsets.ModelViewSet, FlexibleViewSet, SearchViewSet):
    serializer_class = TermSerializer
    queryset = Term.objects.all()

    pagination_class = LatestlCursorPagination
    document_class = TermDocument

    permission_classes = (permissions.IsAuthenticated, EditableTerm)
    serializer_map = {
        "add_terms": AddTermsToDeckSerializer,
        "list": TermNestInDeckSerializer,
        "browse": TermNestInDeckSerializer,
    }

    def generate_q_expression(self, query, **kwargs):
        return TermSearchQuery.build(query, kwargs.get("deck_id"))

    def perform_create(self, serializer):
        term = serializer.save()
        term_service.invalidate_learning_cache(term.deck_id, self.request.user.id)

    def perform_destroy(self, instance):
        term_service.invalidate_learning_cache(instance.deck_id, self.request.user.id)
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
        deck_service.assert_can_view(request.user, deck_id)
        results = self.get_search_results(query, deck_id=deck_id)
        return Response(results)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter("deck_id", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by deck"),
            openapi.Parameter("q", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by name / meaning"),
            openapi.Parameter(
                "sort", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="newest | oldest | az | za"
            ),
            openapi.Parameter("page", openapi.IN_QUERY, type=openapi.TYPE_INTEGER, description="Page number"),
            openapi.Parameter("page_size", openapi.IN_QUERY, type=openapi.TYPE_INTEGER, description="Terms per page"),
        ]
    )
    @action(detail=False, methods=["GET"])
    def browse(self, request, *args, **kwargs):
        """Numbered, searchable, sortable page of a deck's terms — powers the deck editor."""
        deck_id = request.query_params.get("deck_id", "")
        deck_service.assert_can_view(request.user, deck_id)
        queryset = term_service.browse_terms(
            deck_id,
            request.query_params.get("q", ""),
            request.query_params.get("sort", "newest"),
        )
        paginator = TermPageNumberPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = self.get_serializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["deck_id", "ids"],
            properties={
                "deck_id": openapi.Schema(type=openapi.TYPE_STRING),
                "ids": openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_STRING)),
            },
        )
    )
    @action(detail=False, methods=["POST"])
    def bulk_delete(self, request, *args, **kwargs):
        deck_id = request.data.get("deck_id")
        deck = deck_service.get_deck_by_id(deck_id)
        deleted = term_service.delete_terms(deck, request.user, request.data.get("ids"))
        term_service.invalidate_learning_cache(deck_id, request.user.id)
        return Response({"deleted": deleted})

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter("deck_id", openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Filter by deck")
        ]
    )
    def list(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id", "")
        deck_service.assert_can_view(request.user, deck_id)
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
            return Response({"errors": "Please select a deck."}, status=status.HTTP_400_BAD_REQUEST)
        deck = deck_service.get_deck_by_id(deck_id)
        if "image" in request.FILES:
            data["image"] = request.FILES["image"]
        term = term_service.create_term(deck, request.user, data)
        term_service.invalidate_learning_cache(term.deck_id, request.user.id)
        serializer = self.get_serializer(term)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["POST"])
    def add_to_default_deck(self, request, *args, **kwargs):
        term = term_service.add_to_default_deck(request.user, dict(request.data))
        term_service.invalidate_learning_cache(term.deck_id, request.user.id)
        serializer = self.get_serializer(term)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["POST"])
    def add_terms(self, request, *args, **kwargs):
        parsed = term_service.parse_add_terms_payload(request.data)
        deck_id = parsed.get("deck_id")
        if not deck_id:
            return Response({"errors": "Please select a deck."}, status=status.HTTP_400_BAD_REQUEST)
        deck = deck_service.get_deck_by_id(deck_id)
        term_service.add_terms(deck, request.user, parsed["terms"])
        term_service.invalidate_learning_cache(deck_id, request.user.id)
        return Response({"message": "Terms created successfully"})

    @action(detail=False, methods=["PUT"])
    def update_terms(self, request, *args, **kwargs):
        parsed_data = term_service.parse_multipart_terms(request.data)
        term_service.bulk_update_terms(parsed_data)
        return Response({"message": "Terms updated successfully"})

    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["name"],
            properties={
                "name": openapi.Schema(type=openapi.TYPE_STRING),
                "meaning": openapi.Schema(type=openapi.TYPE_STRING),
            },
        )
    )
    @action(detail=False, methods=["POST"])
    def ai_enrich(self, request, *args, **kwargs):
        """Generate Oxford-style fields for a term without persisting them."""
        name = (request.data.get("name") or "").strip()
        meaning = request.data.get("meaning") or ""
        if not name:
            return Response({"errors": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # Cache by name+meaning so re-enriching the same term (e.g. re-opening
            # a noted word in the Speaking Coach) is served without a new AI call.
            data = AiResponseCache.remember(
                "enrich",
                [name.lower(), (meaning or "").strip()],
                lambda: term_enrichment_service.enrich(name, meaning),
            )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(data)

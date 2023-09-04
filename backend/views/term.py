from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from base.views import FlexibleViewSet, SearchViewSet
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import cloudinary.uploader
from ..serializers import TermSerializer, AddTermsToDeckSerializer, TermNestInDeckSerializer
from ..models import Term, Deck
from ..permissions import EditableTerm
from ..services import TermService, learning_progress_cache
from ..documents import TermDocument
from elasticsearch_dsl import Q


class TermViewSet(viewsets.ModelViewSet, FlexibleViewSet, SearchViewSet):
    serializer_class = TermSerializer
    queryset = Term.objects.all()

    pagination_class = None
    document_class = TermDocument

    permission_classes = (permissions.IsAuthenticated, EditableTerm)
    serializer_map = {"add_terms": AddTermsToDeckSerializer}
    serializer_map = {"list": TermNestInDeckSerializer}

    def generate_q_expression(self, query,  **kwargs):
        deck_id = kwargs.get("deck_id")
        search_query = Q('bool', should=[])
        if deck_id:
            search_query.should.append(
                Q('match', deck_id=deck_id)
            )
        if query.strip():
            search_query.should.append(
                Q('multi_match', query=query, fields=[
                    'name', 'description', 'deck.name'])
            )

        return search_query

    def perform_create(self, serializer):
        term = serializer.save()
        learning_progress_cache.delete_combine(
            term.deck_id, self.request.user.id)

    def perform_destroy(self, instance):
        learning_progress_cache.delete_combine(
            instance.deck_id, self.request.user.id)
        instance.delete()

    @swagger_auto_schema(manual_parameters=[
        openapi.Parameter('deck_id', openapi.IN_QUERY,
                          type=openapi.TYPE_STRING, description="Filter by deck"),
        openapi.Parameter('query', openapi.IN_QUERY, type=openapi.TYPE_STRING,
                          description="Search by term name, desc, deck name")])
    def list(self, request, *args, **kwargs):
        deck_id = request.query_params.get("deck_id", "")
        query = request.query_params.get('query', "")
        results = self.get_search_results(query, deck_id=deck_id)
        return Response(results)
        # return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        data = request.data
        deck_id = data.get('deck')
        if not deck_id:
            return Response({"errors": "deck is required"}, status=status.HTTP_400_BAD_REQUEST)
        deck = Deck.objects.filter(pk=deck_id).first()
        if deck and not deck.user_can_edit_deck(request.user):
            return Response({"errors": "user has no permission."}, status=status.HTTP_400_BAD_REQUEST)

        if 'image' in request.FILES:
            image = request.FILES['image']
            uploaded_image = cloudinary.uploader.upload(image)
            data['image'] = uploaded_image.get('url')
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["POST"])
    def add_to_default_deck(self, request, *args, **kwargs):
        default_deck_id = request.user.default_deck_id
        if not default_deck_id:
            return Response({"errors": "Please setup your default deck"}, status=status.HTTP_400_BAD_REQUEST)
        data = request.data
        data["deck"] = default_deck_id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        name = data["name"]
        term = Term.objects.filter(
            deck_id=default_deck_id, name__iexact=name).first()
        if term:
            return Response({"errors": "term is already existed"}, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["POST"])
    def add_terms(self, request, *args, **kwargs):
        deck_id = request.data.get("deck_id")
        if not deck_id:
            return Response({"errors": "deck_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        deck = Deck.objects.filter(pk=deck_id).first()
        if deck and not deck.user_can_edit_deck(request.user):
            return Response({"errors": "user has no permission."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        learning_progress_cache.delete_combine(deck_id, request.user.id)
        return Response({'message': 'Terms created successfully'})

    @action(detail=False, methods=["PUT"])
    def update_terms(self, request, *args, **kwargs):
        TermService.bulk_update_terms(request.data)
        return Response({'message': 'Terms updated successfully'})

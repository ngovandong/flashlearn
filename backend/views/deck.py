from urllib.parse import urlencode

from django.conf import settings
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from backend.deck.infrastructure.search import DeckSearchQuery
from backend.shared.interfaces.viewsets import FlexibleViewSet, SearchViewSet

from ..documents import DeckDocument
from ..models import Deck
from ..permissions import EditableDeck, IsOwnerPermission
from ..serializers import (
    AddUserToDeckSerializer,
    DeckDetailSerializer,
    DeckSerializer,
    InviteSerializer,
    MyDeckSerializer,
    RemoveUserSerializer,
)
from ..services import auth_service, deck_service


class DeckViewSet(viewsets.ModelViewSet, FlexibleViewSet, SearchViewSet):
    serializer_class = DeckSerializer
    queryset = Deck.objects.all()
    pagination_class = None
    document_class = DeckDocument

    permission_classes = (permissions.IsAuthenticated, EditableDeck)

    owner_permission = (permissions.IsAuthenticated, IsOwnerPermission)
    permission_map = {
        "add_user_to_deck": owner_permission,
        "destroy": owner_permission,
        "remove_user_from_deck": owner_permission,
        "get_invite_url": owner_permission,
        "clear_learning_process": permissions.IsAuthenticated,
        "join_deck": permissions.IsAuthenticated,
        "leave_deck": permissions.IsAuthenticated,
        "others_deck": permissions.IsAuthenticated,
        "latest_decks": permissions.IsAuthenticated,
        "set_default_deck": permissions.IsAuthenticated,
    }

    serializer_map = {
        "add_user_to_deck": AddUserToDeckSerializer,
        "remove_user_from_deck": RemoveUserSerializer,
        "my_decks": MyDeckSerializer,
        "my_own_decks": MyDeckSerializer,
        "others_deck": MyDeckSerializer,
        "latest_decks": MyDeckSerializer,
        "retrieve": DeckDetailSerializer,
        "clone": DeckDetailSerializer,
        "get_invite_url": InviteSerializer,
    }

    def get_queryset(self):
        if self.action == "retrieve":
            return deck_service.get_retrieve_queryset(self.request.user)
        return super().get_queryset()

    def generate_q_expression(self, query, **kwargs):
        return DeckSearchQuery.build(query, kwargs.get("user"))

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(
                "query",
                openapi.IN_QUERY,
                type=openapi.TYPE_STRING,
                description="Search by Deck name, user name, or email",
            )
        ]
    )
    @action(detail=False, methods=["GET"])
    def search(self, request, *args, **kwargs):
        query = request.query_params.get("query")
        results = self.get_search_results(query, user=request.user)
        return Response(results)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        deck_service.touch_on_retrieve(instance)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(
                "search",
                openapi.IN_QUERY,
                type=openapi.TYPE_STRING,
                description="Search by Deck name, user name, or email",
            )
        ]
    )
    def list(self, request, *args, **kwargs):
        search_query = request.query_params.get("search")
        self.queryset = deck_service.get_search_queryset(request.user, search_query)
        return super().list(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        deck_service.destroy_deck(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["GET"])
    def my_own_decks(self, request, *args, **kwargs):
        queryset = deck_service.get_my_own_decks(request.user)
        return self.perform_get_list(queryset)

    @action(detail=False, methods=["GET"])
    def others_deck(self, request, *args, **kwargs):
        queryset = deck_service.get_my_others_deck(request.user)
        return self.perform_get_list(queryset)

    @action(detail=False, methods=["GET"])
    def latest_decks(self, request, *args, **kwargs):
        queryset = deck_service.get_latest_decks(request.user)
        return self.perform_get_list(queryset)

    @action(detail=False, methods=["GET"])
    def my_decks(self, request, *args, **kwargs):
        queryset = deck_service.get_my_decks(request.user)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["GET"])
    def public_decks(self, request, *args, **kwargs):
        queryset = deck_service.get_public_decks(request.user)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def add_user_to_deck(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deck_service.add_user_to_deck(
            instance,
            request.user,
            serializer.validated_data["email"],
            serializer.validated_data["role"],
        )
        return Response(DeckSerializer(instance).data)

    @action(detail=True, methods=["POST"])
    def remove_user_from_deck(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deck_service.remove_user_from_deck(instance, request.user, serializer.validated_data["email"])
        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=["POST"])
    def get_invite_url(self, request, pk=None, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data["role"]
        token = auth_service.get_invite_token(pk, role)
        params = urlencode({"token": token})
        invite_url = f"{settings.BASE_FRONTEND_URL}/invite?{params}"
        return Response(invite_url, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["PUT"])
    def clear_learning_process(self, request, pk=None, *args, **kwargs):
        deck_service.clear_learning_process(pk, request.user)
        return Response(
            {"message": "clear learning progress success"},
            status=status.HTTP_204_NO_CONTENT,
        )

    @action(detail=True, methods=["POST"])
    def join_deck(self, request, pk=None, *args, **kwargs):
        deck_service.join_deck(self.get_object(), request.user)
        return Response({"message": "join deck success"}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["POST"])
    def leave_deck(self, request, pk=None, *args, **kwargs):
        deck_service.leave_deck(self.get_object(), request.user)
        return Response({"message": "leave deck success"}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["PUT"])
    def set_default_deck(self, request, *args, **kwargs):
        deck_service.set_default_deck(request.user, self.get_object())
        return Response({"message": "update successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["GET"])
    def clone(self, request, *args, **kwargs):
        try:
            new_deck = deck_service.clone_deck(self.get_object(), request.user)
        except Exception:
            return Response({"errors": "Clone deck fail"}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(new_deck)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

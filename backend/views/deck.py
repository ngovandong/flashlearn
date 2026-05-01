from urllib.parse import urlencode

from django.conf import settings
from django.utils import timezone
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from elasticsearch_dsl import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from base.views import FlexibleViewSet, SearchViewSet

from ..constants import FULL_ROLE_CLASS
from ..documents import DeckDocument
from ..models import Deck, User
from ..permissions import EditableDeck, IsOwnerPermission
from ..serializers import (
    AddUserSerializer,
    DeckDetailSerializer,
    DeckSerializer,
    InviteSerializer,
    MyDeckSerializer,
    RemoveUserSerializer,
)
from ..services import AuthService, DeckService, LearningService, UserService


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
        "remove_user_to_deck": owner_permission,
        "get_invite_url": owner_permission,
        "clear_learning_process": permissions.IsAuthenticated,
        "join_deck": permissions.IsAuthenticated,
        "leave_deck": permissions.IsAuthenticated,
        "others_deck": permissions.IsAuthenticated,
        "latest_decks": permissions.IsAuthenticated,
        "set_default_deck": permissions.IsAuthenticated,
    }

    serializer_map = {
        "add_user_to_deck": AddUserSerializer,
        "remove_user_to_deck": RemoveUserSerializer,
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
            return DeckService.get_retrieve_queryset(self.request.user)
        return super().get_queryset()

    def generate_q_expression(self, query, **kwargs):
        user = kwargs.get("user")
        search_query = Q("bool", should=[])

        # Use multi_match query to search the query across multiple fields
        search_query.should.append(
            Q(
                "multi_match",
                query=query,
                fields=["owner.email", "name", "description", "owner.name^2.0"],
            )
        )

        # Add the condition: (owner = user or user in users)
        user_condition_query = Q(
            "bool",
            should=[
                # Match documents where owner.id is the same as user.id
                Q("match", owner__id=user.id),
                Q("term", is_public=True),
                Q("nested", path="users", query=Q("match", **{"users.id": user.id})),  # Match user in users
            ],
            minimum_should_match=1,
        )

        # Add the user_condition_query as a must clause to satisfy the overall condition
        if query.strip():
            return search_query & user_condition_query
        else:
            return user_condition_query

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
        instance.updated_at = timezone.now()
        instance.save()
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

        self.queryset = DeckService.get_search_queryset(request.user, search_query)
        return super().list(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        User.objects.filter(default_deck=instance).update(default_deck=None)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["GET"])
    def my_own_decks(self, request, *args, **kwargs):
        queryset = DeckService.get_my_own_decks(request.user)
        return self.perform_get_list(queryset)

    @action(detail=False, methods=["GET"])
    def others_deck(self, request, *args, **kwargs):
        queryset = DeckService.get_my_others_deck(request.user)
        return self.perform_get_list(queryset)

    @action(detail=False, methods=["GET"])
    def latest_decks(self, request, *args, **kwargs):
        queryset = DeckService.get_latest_decks(request.user)
        return self.perform_get_list(queryset)

    @action(detail=False, methods=["GET"])
    def my_decks(self, request, *args, **kwargs):
        queryset = DeckService.get_my_decks(request.user)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["GET"])
    def public_decks(self, request, *args, **kwargs):
        queryset = DeckService.get_public_decks(request.user)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def add_user_to_deck(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user_role = serializer.validated_data["role"]

        user_to_add = User.objects.get_by_email(email)

        if user_to_add:
            if user_to_add in instance.users.all() or user_to_add == request.user:
                return Response(
                    {"errors": "user is already in deck"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            return Response({"errors": "user not found"}, status=status.HTTP_400_BAD_REQUEST)
        instance.users.add(user_to_add, through_defaults={"role": user_role})

        deck_serializer = DeckSerializer(instance)
        return Response(deck_serializer.data)

    @action(detail=True, methods=["POST"])
    def remove_user_from_deck(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.get_by_email(email)

        if user:
            if user in instance.users.all() or user == request.user:
                instance.users.remove(user)
                return Response(status=status.HTTP_200_OK)
            return Response({"errors": "user isn't in deck"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"errors": "user not found"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["POST"])
    def get_invite_url(self, request, pk=None, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data["role"]
        token = AuthService.get_invite_token(pk, role)
        params = urlencode({"token": token})
        invite_url = f"{settings.BASE_FRONTEND_URL}/invite?{params}"
        return Response(invite_url, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["PUT"])
    def clear_learning_process(self, request, pk=None, *args, **kwargs):
        LearningService.clear_learning_progress(pk, request.user)
        return Response(
            {"message": "clear learning progress success"},
            status=status.HTTP_204_NO_CONTENT,
        )

    @action(detail=True, methods=["POST"])
    def join_deck(self, request, pk=None, *args, **kwargs):
        user = request.user
        instance = self.get_object()
        if not instance.is_public:
            return Response(
                {"errors": "You have not permission"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user in instance.users.all():
            return Response(
                {"errors": "user is already in deck"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.users.add(user, through_defaults={"role": FULL_ROLE_CLASS.VIEW_ONLY})
        return Response({"message": "join deck success"}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["POST"])
    def leave_deck(self, request, pk=None, *args, **kwargs):
        user = request.user
        instance = self.get_object()
        if user not in instance.users.all():
            return Response({"errors": "user is not in deck"}, status=status.HTTP_400_BAD_REQUEST)
        DeckService.leave_deck(instance, user)
        return Response({"message": "leave deck success"}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["PUT"])
    def set_default_deck(self, request, *args, **kwargs):
        user = request.user
        instance = self.get_object()
        user.default_deck = instance
        user.save()
        UserService.clear_cache(user.id)
        return Response({"message": "update successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["GET"])
    def clone(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            new_deck = DeckService.clone_deck(instance, request.user)
            serializer = self.get_serializer(new_deck)
            return Response(serializer.data)
        except Exception:
            return Response({"errors": "Clone deck fail"}, status=status.HTTP_400_BAD_REQUEST)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

from urllib.parse import urlencode
from rest_framework import viewsets, status, permissions, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count
from django.conf import settings
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from ..serializers import DeckSerializer, AddUserSerializer, RemoveUserSerializer, MyDeckSerializer, \
    DeckDetailSerializer, InviteSerializer
from ..models import Deck, User
from base.views import FlexibleViewSet
from ..permissions import EditableDeck, IsOwnerPermission
from ..services import AuthService, LearningService
from ..constants import FULL_ROLE_CLASS


class DeckViewSet(viewsets.ModelViewSet, FlexibleViewSet):
    serializer_class = DeckSerializer
    queryset = Deck.objects.all()
    pagination_class = None

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
    }

    serializer_map = {
        "add_user_to_deck": AddUserSerializer,
        "remove_user_to_deck": RemoveUserSerializer,
        "my_decks": MyDeckSerializer,
        "retrieve": DeckDetailSerializer,
        "get_invite_url": InviteSerializer
    }

    @swagger_auto_schema(manual_parameters=[
        openapi.Parameter('search', openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Search by Deck name, user name, or email")])
    def list(self, request, *args, **kwargs):
        search_query = request.query_params.get('search')
        queryset = self.get_queryset().filter(
            is_public=True).select_related('owner').prefetch_related('terms')

        if search_query:
            # Filter by search query and term count
            queryset = queryset.annotate(term_count=Count('terms'))
            filtered_queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(owner__name__icontains=search_query) |
                Q(owner__email__icontains=search_query),
                term_count__gt=0
            )
        else:
            # Return the original queryset if no search query is specified
            filtered_queryset = queryset

        self.queryset = filtered_queryset
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["GET"])
    def my_own_decks(self, request, *args, **kwargs):
        queryset = request.user.my_own_decks.all()
        return self.perform_get_list(queryset)

    @action(detail=False, methods=["GET"])
    def my_decks(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        filtered_queryset = queryset.filter(
            user_roles__user=request.user) | request.user.my_own_decks.all()
        return self.perform_get_list(filtered_queryset)

    @action(detail=True, methods=["POST"])
    def add_user_to_deck(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        user_role = serializer.validated_data['role']

        user_to_add = User.objects.get_by_email(email)

        if user_to_add:
            if user_to_add in instance.users.all() or user_to_add == request.user:
                return Response({"errors": "user is already in deck"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"errors": "user not found"}, status=status.HTTP_400_BAD_REQUEST)
        instance.users.add(user_to_add, through_defaults={'role': user_role})

        deck_serializer = DeckSerializer(instance)
        return Response(deck_serializer.data)

    @action(detail=True, methods=["POST"])
    def remove_user_from_deck(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

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
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data['role']
        token = AuthService.get_invite_token(pk, role)
        params = urlencode({'token': token})
        invite_url = f'{settings.BASE_FRONTEND_URL}/invite?{params}'
        return Response(invite_url, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["PUT"])
    def clear_learning_process(self, request, pk=None, *args, **kwargs):
        LearningService.clear_learning_progress(pk, request.user)
        return Response({"message": "clear learning progress success"}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["POST"])
    def join_deck(self, request, pk=None, *args, **kwargs):
        user = request.user
        instance = self.get_object()
        if not instance.is_public:
            return Response({"errors": "You have not permission"}, status=status.HTTP_400_BAD_REQUEST)
        if user in instance.users.all():
            return Response({"errors": "user is already in deck"}, status=status.HTTP_400_BAD_REQUEST)
        instance.users.add(user, through_defaults={
                           'role': FULL_ROLE_CLASS.VIEW_ONLY})
        return Response({"message": "join deck success"}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["POST"])
    def leave_deck(self, request, pk=None, *args, **kwargs):
        user = request.user
        instance = self.get_object()
        if user not in instance.users.all():
            return Response({"errors": "user is not in deck"}, status=status.HTTP_400_BAD_REQUEST)
        instance.users.remove(user)
        return Response({"message": "leave deck success"}, status=status.HTTP_204_NO_CONTENT)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

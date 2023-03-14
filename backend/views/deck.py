from rest_framework import viewsets, status, permissions, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from ..serializers import DeckSerializer, AddUserSerializer, RemoveUserSerializer
from ..models import Deck, User
from base.views import FlexibleViewSet
from ..permissions import EditableDeck, OwnerOfDeck


class DeckViewSet(viewsets.ModelViewSet, FlexibleViewSet):
    serializer_class = DeckSerializer
    queryset = Deck.objects.all()

    permission_classes = (permissions.IsAuthenticated, EditableDeck)
    permission_map = {
        "add_user_to_deck": OwnerOfDeck,
        "delete": OwnerOfDeck,
        "remove_user_to_deck": OwnerOfDeck,
    }

    serializer_map = {
        "add_user_to_deck": AddUserSerializer,
        "remove_user_to_deck": RemoveUserSerializer,
    }

    @action(detail=False, methods=["GET"])
    def my_own_decks(self, request, *args, **kwargs):
        queryset = request.user.my_own_decks.all()
        return self.perform_get_list(queryset)

    @action(detail=False, methods=["GET"])
    def my_decks(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        filtered_queryset = queryset.filter(user_roles__user=request.user) | request.user.my_own_decks.all()
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
    def remove_user_to_deck(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user_to_add = User.objects.get_by_email(email)

        if user_to_add:
            if user_to_add in instance.users.all() or user_to_add == request.user:
                instance.users.remove(user_to_add)
                return Response(status=status.HTTP_200_OK)
            else:
                return Response({"errors": "user isn't in deck"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"errors": "user not found"}, status=status.HTTP_400_BAD_REQUEST)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

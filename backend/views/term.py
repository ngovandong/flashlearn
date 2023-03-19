from rest_framework import viewsets, status, permissions, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from base.views import FlexibleViewSet
from ..serializers import TermSerializer, AddTermsToDeckSerializer
from ..models import Term, Deck
from ..permissions import EditableTerm


class TermViewSet(viewsets.ModelViewSet, FlexibleViewSet):
    serializer_class = TermSerializer
    queryset = Term.objects.all()

    permission_classes = (permissions.IsAuthenticated, EditableTerm)

    serializer_map = {"add_terms": AddTermsToDeckSerializer}

    def create(self, request, *args, **kwargs):
        deck_id = request.data["deck"]
        deck = Deck.objects.filter(pk=deck_id).first()
        if deck and not deck.user_can_edit_deck(request.user):
            return Response({"errors": "user has no permission."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["POST"])
    def add_terms(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Terms created successfully'})

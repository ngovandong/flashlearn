from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from base.views import FlexibleViewSet

from ..models import Deck, UserDeckRole
from ..permissions import IsOwnerOfRolePermission
from ..serializers import UpdateRoleSerializer, UserDeckRoleSerializer
from ..token import JWTToken


class RoleViewSet(FlexibleViewSet):
    serializer_class = UserDeckRoleSerializer
    queryset = UserDeckRole.objects.all()

    permission_classes = (permissions.IsAuthenticated, IsOwnerOfRolePermission)

    serializer_map = {
        "update_role": UpdateRoleSerializer,
    }

    permission_map = {"invite": permissions.IsAuthenticated}

    @action(detail=True, methods=["PUT"])
    def update_role(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if getattr(instance, "_prefetched_objects_cache", None):
            # If 'prefetch_related' has been applied to a queryset, we need to
            # forcibly invalidate the prefetch cache on the instance.
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    @action(detail=False, methods=["GET"])
    def invite(self, request, *args, **kwargs):
        token = request.GET.get("token", None)
        if token is None:
            return Response({"error": "token is required"}, status=status.HTTP_400_BAD_REQUEST)
        t = JWTToken(token)
        try:
            payload = t.get_payload()
            deck_id = payload["deck_id"]
            role = payload["role"]
            deck = Deck.objects.filter(id=deck_id).first()
            if not deck:
                return Response({"error": "deck not found"}, status=status.HTTP_400_BAD_REQUEST)
            if not (request.user in deck.users.all() or request.user == deck.owner):
                deck_role = UserDeckRole(deck=deck, user=request.user, role=role)
                deck_role.save()
            return Response({"deck_id": deck_id}, status=status.HTTP_201_CREATED)
        except Exception:
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

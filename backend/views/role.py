from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from backend.shared.interfaces.viewsets import FlexibleViewSet

from ..models import UserDeckRole
from ..permissions import IsOwnerOfRolePermission
from ..serializers import UpdateRoleSerializer, UserDeckRoleSerializer
from ..services import RoleService


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
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    @action(detail=False, methods=["GET"])
    def invite(self, request, *args, **kwargs):
        token = request.GET.get("token", None)
        deck_id = RoleService.accept_invite(token, request.user)
        return Response({"deck_id": deck_id}, status=status.HTTP_201_CREATED)

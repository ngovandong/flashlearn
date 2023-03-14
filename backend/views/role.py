from rest_framework import viewsets, status, permissions, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from base.views import FlexibleViewSet
from ..serializers import UserDeckRoleSerializer, UpdateRoleSerializer
from ..models import UserDeckRole
from ..permissions import OwnerOfDeck


class RoleViewSet(viewsets.ModelViewSet, FlexibleViewSet):
    serializer_class = UserDeckRoleSerializer
    queryset = UserDeckRole.objects.all()

    permission_classes = (permissions.IsAuthenticated, OwnerOfDeck)

    serializer_map = {"update_role": UpdateRoleSerializer}

    @action(detail=True, methods=['PUT'])
    def update_role(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if getattr(instance, '_prefetched_objects_cache', None):
            # If 'prefetch_related' has been applied to a queryset, we need to
            # forcibly invalidate the prefetch cache on the instance.
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

from rest_framework import permissions, viewsets

from backend.shared.interfaces.viewsets import FlexibleViewSet

from ..models import Folder
from ..permissions import IsOwnerPermission
from ..serializers import FolderSerializer
from ..services import FolderService


class FolderViewSet(viewsets.ModelViewSet, FlexibleViewSet):
    serializer_class = FolderSerializer
    queryset = Folder.objects.all()
    pagination_class = None

    permission_classes = (permissions.IsAuthenticated, IsOwnerPermission)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "list":
            return FolderService.list_for_owner(self.request.user)
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from ..serializers import FolderSerializer
from ..models import Folder
from base.views import FlexibleViewSet
from ..permissions import IsOwnerPermission


class FolderViewSet(viewsets.ModelViewSet, FlexibleViewSet):
    serializer_class = FolderSerializer
    queryset = Folder.objects.all()

    permission_classes = (permissions.IsAuthenticated, IsOwnerPermission)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'list':
            return queryset.filter(owner=self.request.user)
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

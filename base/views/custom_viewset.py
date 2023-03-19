from rest_framework import viewsets
from rest_framework.serializers import Serializer
from rest_framework.response import Response


class FlexibleViewSet(viewsets.GenericViewSet):
    serializer_class = Serializer
    serializer_map = {}
    permission_map = {}

    def get_serializer_class(self):
        """
            Get serializer for each action
        """
        return self.serializer_map.get(self.action, self.serializer_class)

    def get_permissions(self):
        """
            Get permission for each action
        """
        permissions = self.permission_map.get(self.action, self.permission_classes)
        if not (isinstance(permissions, list) or isinstance(permissions, tuple)):
            permissions = [permissions]
        return [permission() for permission in permissions]

    def perform_get_list(self, queryset):
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

import abc

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.serializers import Serializer


class FlexibleViewSet(viewsets.GenericViewSet):
    serializer_class = Serializer
    serializer_map = {}
    permission_map = {}

    def get_serializer_class(self):
        return self.serializer_map.get(self.action, self.serializer_class)

    def get_permissions(self):
        permissions = self.permission_map.get(self.action, self.permission_classes)
        if not isinstance(permissions, list | tuple):
            permissions = [permissions]
        return [permission() for permission in permissions]

    def perform_get_list(self, queryset):
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class SearchViewSet(viewsets.GenericViewSet):
    document_class = None

    @abc.abstractmethod
    def generate_q_expression(self, query, **kwargs):
        """Return a Q() expression for Elasticsearch."""

    def get_search_results(self, query, **kwargs):
        q = self.generate_q_expression(query, **kwargs)
        search = self.document_class.search().query(q)
        response = search.execute()

        page = self.paginate_queryset(response)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(response, many=True)
        return serializer.data

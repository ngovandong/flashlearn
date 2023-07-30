from rest_framework import viewsets
import abc


class SearchViewSet(viewsets.GenericViewSet):
    document_class = None

    @abc.abstractmethod
    def generate_q_expression(self, query, request):
        """This method should be overridden
        and return a Q() expression."""

    def get_search_results(self, request, query):
        q = self.generate_q_expression(query, request)
        search = self.document_class.search().query(q)
        response = search.execute()

        print(
            f'Found {response.hits.total.value} hit(s) for query: "{query}"')

        page = self.paginate_queryset(response)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(response, many=True)
        return serializer.data

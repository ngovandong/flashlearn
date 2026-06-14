from rest_framework import status, views
from rest_framework.response import Response

from ..services.crawler import BSCrawler


class GetImagesUrlView(views.APIView):
    def post(self, request, format=None):
        query = request.data.get("query")
        count = request.data.get("count", 10)
        if not query:
            return Response({"error": "Please enter a search term."}, status=status.HTTP_400_BAD_REQUEST)

        urls = BSCrawler.get_preview_images(query, count)

        return Response({"query": query, "urls": urls}, status=status.HTTP_200_OK)

from rest_framework.pagination import PageNumberPagination


class DeckPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class TermPageNumberPagination(PageNumberPagination):
    """Numbered pages for the deck editor, so a 600-term deck is browsable by page."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class CoursePageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50

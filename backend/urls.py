from django.conf import settings
from django.urls import include, path, re_path
from rest_framework import routers

from .views import (
    CourseViewSet,
    DeckViewSet,
    FolderViewSet,
    GetImagesUrlView,
    LearningViewSet,
    ListeningViewSet,
    ReminderViewSet,
    RoleViewSet,
    SpeakingViewSet,
    TermViewSet,
    TranslateView,
    UserViewSet,
    WritingViewSet,
)

router = routers.DefaultRouter()
router.register(r"decks", DeckViewSet, basename="deck")
router.register(r"terms", TermViewSet, basename="term")
router.register(r"users", UserViewSet, basename="user")
router.register(r"folders", FolderViewSet, basename="folder")
router.register(r"roles", RoleViewSet, basename="role")
router.register(r"learnings", LearningViewSet, basename="learning")
router.register(r"speaking", SpeakingViewSet, basename="speaking")
router.register(r"writing", WritingViewSet, basename="writing")
router.register(r"courses", CourseViewSet, basename="course")
router.register(r"listening", ListeningViewSet, basename="listening")
router.register(r"reminders", ReminderViewSet, basename="reminder")

# Wire up our API using automatic URL routing.
# Additionally, we include login URLs for the browsable API.
urlpatterns = [
    path("", include(router.urls)),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
    path("images/", GetImagesUrlView.as_view(), name="images"),
    path("translate/", TranslateView.as_view(), name="translate"),
]

if settings.DEBUG:
    from drf_yasg import openapi
    from drf_yasg.views import get_schema_view
    from rest_framework import permissions

    schema_view = get_schema_view(
        openapi.Info(
            title="Snippets API",
            default_version="v1",
            description="Test description",
            terms_of_service="https://www.google.com/policies/terms/",
            contact=openapi.Contact(email="contact@snippets.local"),
            license=openapi.License(name="BSD License"),
        ),
        public=True,
        permission_classes=[permissions.AllowAny],
    )
    urlpatterns += [
        re_path(r"^swagger(?P<format>\.json|\.yaml)$", schema_view.without_ui(cache_timeout=0), name="schema-json"),
        re_path(r"^swagger/$", schema_view.with_ui("swagger", cache_timeout=0), name="schema-swagger-ui"),
        re_path(r"^redoc/$", schema_view.with_ui("redoc", cache_timeout=0), name="schema-redoc"),
    ]

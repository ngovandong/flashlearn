import importlib.util
import os

from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path

from .proxy import NextChatProxyView


def serve_image(request, path):
    # Prevent path traversal: only allow a single filename with no separators
    filename = os.path.basename(path)
    if not filename or filename != path:
        return HttpResponse(status=404)
    image_path = os.path.join(settings.MEDIA_ROOT, "default", filename)
    # Ensure the resolved path stays inside MEDIA_ROOT/default/
    allowed_root = os.path.realpath(os.path.join(settings.MEDIA_ROOT, "default"))
    if not os.path.realpath(image_path).startswith(allowed_root + os.sep):
        return HttpResponse(status=404)
    try:
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()
    except OSError:
        return HttpResponse(status=404)
    return HttpResponse(image_data, content_type="image/jpeg")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("backend.urls"), name="api"),
    re_path("nextchat/" + r"(?P<path>.*)", NextChatProxyView.as_view()),
    path("images/<str:path>/", serve_image, name="serve_image"),
]

if settings.DEBUG and importlib.util.find_spec("debug_toolbar"):
    urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]

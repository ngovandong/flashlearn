from django.contrib import admin
from django.urls import path, include
from django.conf import settings


from django.http import HttpResponse


def serve_image(request, path):
    try:
        image_path = f"{settings.MEDIA_ROOT}/default/{path}"
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()
    except:
        return HttpResponse(status=404)
    return HttpResponse(image_data, content_type="image/jpeg")


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('backend.urls'), name='api'),
    path('images/<str:path>/', serve_image, name='serve_image'),
    path('__debug__/', include('debug_toolbar.urls'))
]

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from backend.routing import websocket_urlpatterns  # noqa: E402

# Middleware to help with custom token auth if needed, but for now we might use a custom middleware
# Since our CustomTokenAuthentication is DRF-based, it's not directly compatible with Channels middleware stack out of the box without some wrapping.
# For simplicity, we can pass the token in query string and use a custom middleware stack or just check it in connect().
# Let's create a minimal setup first.

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": URLRouter(websocket_urlpatterns),
    }
)

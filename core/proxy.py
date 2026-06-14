from revproxy.views import ProxyView


class NextChatProxyView(ProxyView):
    upstream: str = "http://localhost:8080"

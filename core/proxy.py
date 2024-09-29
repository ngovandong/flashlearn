from revproxy.views import ProxyView


class NextChatProxyView(ProxyView):
    upstream = 'http://localhost:8080'
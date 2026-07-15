from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..services import assistant_service
from ..shared.infrastructure.ai import AiProviderError


class AssistantViewSet(viewsets.ViewSet):
    """Dragon assistant: a general English-learning chat that also guides the app.

    Thin transport layer — it parses the request, calls
    :class:`AssistantService` and maps errors to HTTP status codes. All prompts,
    rules and AI calls live in the application service. The chat is stateless:
    the client sends the recent ``history`` with every message.
    """

    permission_classes = (permissions.IsAuthenticated,)

    @action(detail=False, methods=["POST"])
    def chat(self, request, *args, **kwargs):
        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"errors": "Please type a message first."}, status=status.HTTP_400_BAD_REQUEST)
        history = request.data.get("history")
        history = history if isinstance(history, list) else []
        try:
            result = assistant_service.chat(
                message=message,
                history=history,
                page=(request.data.get("page") or "").strip(),
            )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)

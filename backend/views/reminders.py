from rest_framework import permissions, viewsets
from rest_framework.response import Response

from ..services import reminder_service


class ReminderViewSet(viewsets.ViewSet):
    """Home-page "pick up where you left off" prompts.

    Thin transport layer — availability checks, randomization and routing all
    live in :class:`ReminderService`.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def list(self, request, *args, **kwargs):
        return Response(reminder_service.for_user(request.user))

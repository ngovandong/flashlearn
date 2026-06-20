from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..serializers import WritingSessionSerializer
from ..services import writing_service
from ..shared.infrastructure.ai import AiProviderError


class WritingViewSet(viewsets.ViewSet):
    """Writing Coach: AI chat practice, free-form draft assessment and history.

    This viewset is a thin transport layer — it parses requests, serializes
    results and maps errors to HTTP status codes. All rules, AI calls and data
    access live in :class:`WritingService` (application) and its repository.
    """

    permission_classes = (permissions.IsAuthenticated,)

    @action(detail=False, methods=["POST"])
    def suggest_topics(self, request, *args, **kwargs):
        history = request.data.get("history")
        history = history if isinstance(history, list) else []
        level = (request.data.get("level") or "").strip() or None
        return Response({"topics": writing_service.suggest_topics(history, level)})

    @action(detail=False, methods=["POST"])
    def start_chat(self, request, *args, **kwargs):
        data = request.data
        try:
            session = writing_service.start_chat(
                request.user,
                topic=data.get("topic", ""),
                level=data.get("level"),
                tone=data.get("tone"),
            )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(WritingSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["POST"])
    def chat_message(self, request, pk=None, *args, **kwargs):
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"errors": "Please write a message first."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            session = writing_service.chat_message(request.user, pk, text)
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        if session is None:
            return Response({"errors": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(WritingSessionSerializer(session).data)

    @action(detail=False, methods=["POST"])
    def writing_support(self, request, *args, **kwargs):
        topic = (request.data.get("topic") or "").strip()
        level = (request.data.get("level") or "").strip() or None
        if not topic:
            return Response({"errors": "Please choose a topic first."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            data = writing_service.writing_support(topic, level)
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(data)

    @action(detail=False, methods=["POST"])
    def submit_draft(self, request, *args, **kwargs):
        draft = (request.data.get("draft") or "").strip()
        if not draft:
            return Response({"errors": "Please write something first."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            session = writing_service.submit_draft(
                request.user,
                topic=request.data.get("topic", ""),
                draft=draft,
                level=request.data.get("level"),
                tone=request.data.get("tone"),
            )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(WritingSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["POST"])
    def explain_phrase(self, request, *args, **kwargs):
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"errors": "Please enter some text."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            data = writing_service.explain_phrase(text, request.data.get("context") or "")
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(data)

    @action(detail=False, methods=["GET"])
    def history(self, request, *args, **kwargs):
        sessions = writing_service.history(request.user)
        return Response({"sessions": WritingSessionSerializer(sessions, many=True).data})

    def retrieve(self, request, pk=None, *args, **kwargs):
        """Load a saved session by id so it can be opened by URL."""
        session = writing_service.get_session(request.user, pk)
        if session is None:
            return Response({"errors": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(WritingSessionSerializer(session).data)

    def destroy(self, request, pk=None, *args, **kwargs):
        """Delete a single session."""
        deleted = writing_service.delete_sessions(request.user, [pk])
        if not deleted:
            return Response({"errors": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["POST"])
    def star(self, request, pk=None, *args, **kwargs):
        """Star or unstar a session so it sorts to the top of history."""
        session = writing_service.get_session(request.user, pk)
        if session is None:
            return Response({"errors": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        session = writing_service.set_star(session, request.data.get("starred"))
        return Response({"id": str(session.id), "starred": session.starred})

    @action(detail=True, methods=["POST"])
    def highlight(self, request, pk=None, *args, **kwargs):
        """Add, update or remove a noted word/phrase on a session."""
        session = writing_service.get_session(request.user, pk)
        if session is None:
            return Response({"errors": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"errors": "Please enter some text."}, status=status.HTTP_400_BAD_REQUEST)
        highlights = writing_service.update_highlight(
            session,
            text=text,
            note=(request.data.get("note") or "").strip(),
            remove=bool(request.data.get("remove")),
        )
        return Response({"id": str(session.id), "highlights": highlights})

    @action(detail=False, methods=["POST"])
    def match_terms(self, request, *args, **kwargs):
        """The user's own terms that appear in a session's text."""
        matches = writing_service.match_terms(
            request.user,
            texts=request.data.get("texts"),
            session_id=request.data.get("session_id"),
        )
        return Response({"matches": matches})

    @action(detail=False, methods=["POST"])
    def bulk_delete(self, request, *args, **kwargs):
        """Delete many sessions at once by id."""
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response({"errors": "Please select at least one session."}, status=status.HTTP_400_BAD_REQUEST)
        deleted = writing_service.delete_sessions(request.user, ids)
        return Response({"deleted": deleted})

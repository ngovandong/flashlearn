from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import SpeakingAnalysis
from ..serializers import SpeakingAnalysisSerializer, SpeakingConversationSerializer
from ..services import speaking_service
from ..shared.infrastructure.ai import AiProviderError


class SpeakingViewSet(viewsets.ViewSet):
    """Speaking Coach: AI dialogue generation, pronunciation analysis and history.

    This viewset is a thin transport layer — it parses requests, serializes
    results and maps errors to HTTP status codes. All rules, AI calls and data
    access live in :class:`SpeakingService` (application) and its repository.
    """

    permission_classes = (permissions.IsAuthenticated,)

    @action(detail=False, methods=["POST"])
    def generate_conversation(self, request, *args, **kwargs):
        data = request.data
        try:
            record = speaking_service.generate_conversation(
                request.user,
                topic=data.get("topic", ""),
                accent=data.get("accent", "US") or "US",
                user_name=data.get("user_name") or "Me",
                partner_name=data.get("partner_name") or "Coach",
                custom_text=data.get("custom_text"),
                level=data.get("level"),
                tone=data.get("tone"),
                turns=data.get("turns", 6),
                voice=data.get("voice"),
                use_vocabulary=bool(data.get("use_vocabulary")),
            )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(SpeakingConversationSerializer(record).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["POST"])
    def suggest_topics(self, request, *args, **kwargs):
        history = request.data.get("history")
        history = history if isinstance(history, list) else []
        level = (request.data.get("level") or "").strip() or None
        return Response({"topics": speaking_service.suggest_topics(history, level)})

    @action(detail=False, methods=["POST"])
    def analyze(self, request, *args, **kwargs):
        target_text = (request.data.get("target_text") or "").strip()
        audio = request.data.get("audio") or ""
        if not target_text:
            return Response(
                {"errors": "Please provide the text you're practicing."}, status=status.HTTP_400_BAD_REQUEST
            )
        if not audio:
            return Response({"errors": "Please record your audio first."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            record, result = speaking_service.analyze(
                request.user,
                target_text=target_text,
                audio=audio,
                mime_type=request.data.get("mime_type") or "audio/webm",
                kind=request.data.get("kind") or SpeakingAnalysis.KIND_SINGLE,
                conversation_id=request.data.get("conversation_id"),
            )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        payload = SpeakingAnalysisSerializer(record).data
        # Echo the camelCase analysis shape the UI renders directly.
        payload["result"] = result
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["GET"])
    def voices(self, request, *args, **kwargs):
        return Response(speaking_service.voices())

    @action(detail=False, methods=["POST"])
    def speak(self, request, *args, **kwargs):
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"errors": "Please enter some text."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            clip = speaking_service.speak(text, request.data.get("voice"))
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        # Prefer the Cloudinary URL; ``audio`` (base64) stays as a fallback for
        # clips not yet migrated off inline storage.
        return Response({"audio_url": clip.audio_url, "audio": clip.audio, "mime_type": clip.mime_type})

    @action(detail=False, methods=["POST"])
    def explain_phrase(self, request, *args, **kwargs):
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"errors": "Please enter some text."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            data = speaking_service.explain_phrase(text, request.data.get("context") or "")
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(data)

    @action(detail=False, methods=["GET"])
    def history(self, request, *args, **kwargs):
        conversations, analyses = speaking_service.history(request.user)
        return Response(
            {
                "conversations": SpeakingConversationSerializer(conversations, many=True).data,
                "analyses": SpeakingAnalysisSerializer(analyses, many=True).data,
            }
        )

    def retrieve(self, request, pk=None, *args, **kwargs):
        """Load a saved conversation by id so it can be opened by URL."""
        conversation = speaking_service.get_conversation(request.user, pk)
        if conversation is None:
            return Response({"errors": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SpeakingConversationSerializer(conversation).data)

    def destroy(self, request, pk=None, *args, **kwargs):
        """Delete a single conversation (and its now-orphaned audio clips)."""
        deleted = speaking_service.delete_conversations(request.user, [pk])
        if not deleted:
            return Response({"errors": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["POST"])
    def star(self, request, pk=None, *args, **kwargs):
        """Star or unstar a conversation so it sorts to the top of history."""
        conversation = speaking_service.get_conversation(request.user, pk)
        if conversation is None:
            return Response({"errors": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
        conversation = speaking_service.set_star(conversation, request.data.get("starred"))
        return Response({"id": str(conversation.id), "starred": conversation.starred})

    @action(detail=True, methods=["POST"])
    def highlight(self, request, pk=None, *args, **kwargs):
        """Add, update or remove a noted word/phrase on a conversation."""
        conversation = speaking_service.get_conversation(request.user, pk)
        if conversation is None:
            return Response({"errors": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"errors": "Please enter some text."}, status=status.HTTP_400_BAD_REQUEST)
        highlights = speaking_service.update_highlight(
            conversation,
            text=text,
            note=(request.data.get("note") or "").strip(),
            remove=bool(request.data.get("remove")),
        )
        return Response({"id": str(conversation.id), "highlights": highlights})

    @action(detail=False, methods=["POST"])
    def match_terms(self, request, *args, **kwargs):
        """The user's own terms that appear in a conversation's lines."""
        matches = speaking_service.match_terms(
            request.user,
            texts=request.data.get("texts"),
            conversation_id=request.data.get("conversation_id"),
        )
        return Response({"matches": matches})

    @action(detail=False, methods=["POST"])
    def bulk_delete(self, request, *args, **kwargs):
        """Delete many conversations at once by id."""
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response({"errors": "Please select at least one conversation."}, status=status.HTTP_400_BAD_REQUEST)
        deleted = speaking_service.delete_conversations(request.user, ids)
        return Response({"deleted": deleted})

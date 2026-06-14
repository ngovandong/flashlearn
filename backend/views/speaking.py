import re

from django.db.models.functions import Greatest
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import (
    AiResponseCache,
    SpeakingAnalysis,
    SpeakingAudioClip,
    SpeakingConversation,
    Term,
    UserLearningProgress,
)
from ..serializers import SpeakingAnalysisSerializer, SpeakingConversationSerializer
from ..services import speaking_coach_service
from ..shared.infrastructure.ai import AiProviderError
from ..speaking import topics as speaking_topics
from ..speaking.application.services import DEFAULT_TTS_VOICE, TTS_VOICES


class SpeakingViewSet(viewsets.ViewSet):
    """Speaking Coach: AI dialogue generation, pronunciation analysis and history.

    The frontend stays a pure UI layer — all prompts, rules and AI calls live in
    ``SpeakingCoachService``; this viewset only validates input, runs the service
    and persists results to the user's history.
    """

    permission_classes = (permissions.IsAuthenticated,)

    @action(detail=False, methods=["POST"])
    def generate_conversation(self, request, *args, **kwargs):
        data = request.data
        topic = data.get("topic", "")
        accent = data.get("accent", "US")
        user_name = data.get("user_name") or "Me"
        partner_name = data.get("partner_name") or "Coach"
        custom_text = data.get("custom_text")
        level = data.get("level")
        tone = data.get("tone")
        turns = data.get("turns", 6)
        vocabulary = self._vocabulary_words(request.user) if data.get("use_vocabulary") else None

        def _produce():
            return speaking_coach_service.generate_conversation(
                topic=topic,
                accent=accent,
                user_name=user_name,
                partner_name=partner_name,
                custom_text=custom_text,
                level=level,
                tone=tone,
                turns=turns,
                vocabulary=vocabulary,
            )

        try:
            if vocabulary:
                # Inputs are randomized per request and we want variety, so skip
                # the response cache for vocabulary practice.
                conversation = _produce()
            else:
                # Reuse the AI output for an identical request (same topic/settings)
                # instead of re-billing the provider; a new history record is still
                # created below so the user keeps a fresh entry each time.
                conversation = AiResponseCache.remember(
                    "conversation",
                    [topic, accent, user_name, partner_name, custom_text, level, tone, turns],
                    _produce,
                )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        record = SpeakingConversation.objects.create(
            user=request.user,
            topic=conversation["topic"],
            context=conversation["context"],
            accent=data.get("accent", "US") or "",
            level=data.get("level") or "",
            tone=data.get("tone") or "",
            lines=conversation["lines"],
        )
        return Response(SpeakingConversationSerializer(record).data, status=status.HTTP_201_CREATED)

    @staticmethod
    def _vocabulary_words(user, recent=20, total=100):
        """Pick up to ``total`` of the user's own term names to weave into a dialogue.

        The first ``recent`` are the most recently revised/learned terms; the rest
        are random other owned terms. Returns a de-duplicated, order-preserving list.
        """
        recent_rows = list(
            UserLearningProgress.objects.filter(user=user, term__deck__owner=user)
            .annotate(last_at=Greatest("last_revised_at", "last_learned_at"))
            .order_by("-last_at")
            .values_list("term_id", "term__name")[:recent]
        )
        recent_ids = [row[0] for row in recent_rows]

        names: list[str] = []
        seen: set[str] = set()

        def _add(name):
            cleaned = (name or "").strip()
            key = cleaned.lower()
            if cleaned and key not in seen:
                seen.add(key)
                names.append(cleaned)

        for _, name in recent_rows:
            _add(name)

        remaining = total - len(names)
        if remaining > 0:
            random_names = (
                Term.objects.filter(deck__owner=user)
                .exclude(id__in=recent_ids)
                .order_by("?")
                .values_list("name", flat=True)[:remaining]
            )
            for name in random_names:
                _add(name)

        return names

    @action(detail=False, methods=["POST"])
    def suggest_topics(self, request, *args, **kwargs):
        history = request.data.get("history") or []
        if not isinstance(history, list):
            history = []
        level = (request.data.get("level") or "").strip() or None
        topics = speaking_topics.random_for_level(level=level, exclude=history, limit=5)
        # Fall back to the AI suggester only if the topics file is empty/missing.
        if not topics:
            topics = speaking_coach_service.suggest_topics(history)
        return Response({"topics": topics})

    @action(detail=False, methods=["POST"])
    def analyze(self, request, *args, **kwargs):
        target_text = (request.data.get("target_text") or "").strip()
        audio = request.data.get("audio") or ""
        mime_type = request.data.get("mime_type") or "audio/webm"
        kind = request.data.get("kind") or SpeakingAnalysis.KIND_SINGLE
        conversation_id = request.data.get("conversation_id")
        if not target_text:
            return Response({"errors": "target_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not audio:
            return Response({"errors": "audio is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = speaking_coach_service.analyze_pronunciation(
                target_text, audio, mime_type=mime_type, full_session=(kind == SpeakingAnalysis.KIND_FULL)
            )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        conversation = None
        if conversation_id:
            conversation = SpeakingConversation.objects.filter(id=conversation_id, user=request.user).first()

        record = SpeakingAnalysis.objects.create(
            user=request.user,
            conversation=conversation,
            kind=kind
            if kind in (SpeakingAnalysis.KIND_SINGLE, SpeakingAnalysis.KIND_FULL)
            else SpeakingAnalysis.KIND_SINGLE,
            target_text=target_text,
            transcription=result["transcription"],
            accuracy_score=result["accuracyScore"],
            fluency_score=result["fluencyScore"],
            completeness_score=result["completenessScore"],
            rhythm_score=result["rhythmScore"],
            words_per_minute=result["wordsPerMinute"],
            accent_analysis=result["accentAnalysis"],
            overall_feedback=result["overallFeedback"],
            key_struggles=result["keyStruggles"],
            word_analysis=result["wordAnalysis"],
        )
        payload = SpeakingAnalysisSerializer(record).data
        # Echo the camelCase analysis shape the UI renders directly.
        payload["result"] = result
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["GET"])
    def voices(self, request, *args, **kwargs):
        """Available reference tutor voices the learner can pick from."""
        return Response({"voices": TTS_VOICES, "default": DEFAULT_TTS_VOICE})

    @action(detail=False, methods=["POST"])
    def speak(self, request, *args, **kwargs):
        """Synthesize one line (cache-first) with the selected tutor voice."""
        text = (request.data.get("text") or "").strip()
        voice = self._clean_voice(request.data.get("voice"))
        if not text:
            return Response({"errors": "text is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            clip = self._get_or_create_clip(text, voice)
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"audio": clip.audio, "mime_type": clip.mime_type})

    @staticmethod
    def _clean_voice(value):
        voice = value or DEFAULT_TTS_VOICE
        return voice if voice in TTS_VOICES else DEFAULT_TTS_VOICE

    @staticmethod
    def _get_or_create_clip(text, voice):
        text_hash = SpeakingAudioClip.hash_text(text)
        clip = SpeakingAudioClip.objects.filter(voice=voice, text_hash=text_hash).first()
        if clip is not None:
            return clip
        result = speaking_coach_service.synthesize_speech(text, voice)
        clip, _ = SpeakingAudioClip.objects.get_or_create(
            voice=voice,
            text_hash=text_hash,
            defaults={
                "text": text,
                "audio": result["audio"],
                "mime_type": result.get("mime_type", "audio/L16;rate=24000"),
            },
        )
        return clip

    @action(detail=False, methods=["POST"])
    def explain_phrase(self, request, *args, **kwargs):
        text = (request.data.get("text") or "").strip()
        context = request.data.get("context") or ""
        if not text:
            return Response({"errors": "text is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # Same word in the same line context returns identical guidance, so
            # re-opening a noted highlight is a cache hit (no extra AI call).
            data = AiResponseCache.remember(
                "explain_phrase",
                [text.lower(), (context or "").strip()],
                lambda: speaking_coach_service.explain_phrase(text, context),
            )
            return Response(data)
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    @action(detail=False, methods=["GET"])
    def history(self, request, *args, **kwargs):
        conversations = SpeakingConversation.objects.filter(user=request.user)[:30]
        analyses = SpeakingAnalysis.objects.filter(user=request.user)[:30]
        return Response(
            {
                "conversations": SpeakingConversationSerializer(conversations, many=True).data,
                "analyses": SpeakingAnalysisSerializer(analyses, many=True).data,
            }
        )

    def retrieve(self, request, pk=None, *args, **kwargs):
        """Load a saved conversation by id so it can be opened by URL."""
        conversation = SpeakingConversation.objects.filter(id=pk, user=request.user).first()
        if conversation is None:
            return Response({"errors": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(SpeakingConversationSerializer(conversation).data)

    def destroy(self, request, pk=None, *args, **kwargs):
        """Delete a single conversation from the user's history."""
        deleted, _ = SpeakingConversation.objects.filter(id=pk, user=request.user).delete()
        if not deleted:
            return Response({"errors": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["POST"])
    def star(self, request, pk=None, *args, **kwargs):
        """Star or unstar a conversation so it sorts to the top of history."""
        conversation = SpeakingConversation.objects.filter(id=pk, user=request.user).first()
        if conversation is None:
            return Response({"errors": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)
        starred = request.data.get("starred")
        conversation.starred = (not conversation.starred) if starred is None else bool(starred)
        conversation.save(update_fields=["starred", "updated_at"])
        return Response({"id": str(conversation.id), "starred": conversation.starred})

    @action(detail=True, methods=["POST"])
    def highlight(self, request, pk=None, *args, **kwargs):
        """Add, update or remove a noted word/phrase on a conversation.

        Highlights are re-rendered when the conversation is reopened and clicking
        one re-shows the Vocabulary Coach popup. Pass ``remove=true`` to clear it.
        """
        conversation = SpeakingConversation.objects.filter(id=pk, user=request.user).first()
        if conversation is None:
            return Response({"errors": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"errors": "text is required"}, status=status.HTTP_400_BAD_REQUEST)
        note = (request.data.get("note") or "").strip()
        remove = bool(request.data.get("remove"))

        highlights = [h for h in (conversation.highlights or []) if isinstance(h, dict) and h.get("text")]
        lowered = text.lower()
        existing = next((h for h in highlights if (h.get("text") or "").lower() == lowered), None)
        if remove:
            highlights = [h for h in highlights if (h.get("text") or "").lower() != lowered]
        elif existing is not None:
            existing["note"] = note
        else:
            highlights.append({"text": text, "note": note})

        conversation.highlights = highlights
        conversation.save(update_fields=["highlights", "updated_at"])
        return Response({"id": str(conversation.id), "highlights": highlights})

    @action(detail=False, methods=["POST"])
    def match_terms(self, request, *args, **kwargs):
        """Return the user's own terms that appear in a conversation's lines.

        Used by the frontend to highlight already-saved terms and deep-link each
        to ``/deck/<deck_id>/learn/<term_id>``. Accepts either ``conversation_id``
        or a raw list of ``texts``. When the same word lives in several decks the
        first one encountered wins.
        """
        texts = request.data.get("texts")
        conversation_id = request.data.get("conversation_id")
        if conversation_id and not isinstance(texts, list):
            conversation = SpeakingConversation.objects.filter(id=conversation_id, user=request.user).first()
            texts = [line.get("text", "") for line in (conversation.lines or [])] if conversation else []
        if not isinstance(texts, list):
            texts = []

        full_text = "\n".join(t for t in texts if isinstance(t, str)).lower()
        if not full_text.strip():
            return Response({"matches": []})

        words = set(re.findall(r"[a-z']+", full_text))
        matches = []
        seen = set()
        for term in Term.objects.filter(deck__owner=request.user).values("id", "name", "deck_id"):
            name = (term["name"] or "").strip()
            lowered = name.lower()
            if not lowered or lowered in seen:
                continue
            tokens = lowered.split()
            found = (lowered in words) if len(tokens) == 1 else (lowered in full_text)
            if found:
                seen.add(lowered)
                matches.append({"term_id": str(term["id"]), "deck_id": str(term["deck_id"]), "name": name})
        return Response({"matches": matches})

    @action(detail=False, methods=["POST"])
    def bulk_delete(self, request, *args, **kwargs):
        """Delete many conversations at once by id."""
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response({"errors": "ids must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = SpeakingConversation.objects.filter(id__in=ids, user=request.user).delete()
        return Response({"deleted": deleted})

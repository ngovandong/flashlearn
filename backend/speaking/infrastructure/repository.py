"""Persistence for the Speaking Coach feature.

All Django ORM access for speaking conversations, pronunciation analyses, the
shared TTS audio-clip cache and the AI response cache lives here so the
application service and the DRF viewset never touch the ORM directly.
"""

from django.db.models.functions import Greatest

from backend.models import (
    AiResponseCache,
    SpeakingAnalysis,
    SpeakingAudioClip,
    SpeakingConversation,
    Term,
    UserLearningProgress,
)


class SpeakingRepository:
    # ── Conversations ─────────────────────────────────────────────────────
    @staticmethod
    def create_conversation(*, user, topic, context, accent, level, tone, voice, lines):
        return SpeakingConversation.objects.create(
            user=user,
            topic=topic,
            context=context,
            accent=accent,
            level=level,
            tone=tone,
            voice=voice,
            lines=lines,
        )

    @staticmethod
    def get_conversation(user, conversation_id):
        return SpeakingConversation.objects.filter(id=conversation_id, user=user).first()

    @staticmethod
    def recent_conversations(user, limit=30):
        return SpeakingConversation.objects.filter(user=user)[:limit]

    @staticmethod
    def save_conversation(conversation, fields):
        conversation.save(update_fields=fields)

    @staticmethod
    def delete_conversations(user, ids):
        """Delete the user's conversations and prune now-orphaned audio clips.

        Returns the number of conversations deleted. The TTS clip cache is shared
        across all users/conversations, so a clip is only removed once no
        surviving conversation still references its ``(voice, text)`` pair.
        """
        queryset = SpeakingConversation.objects.filter(id__in=ids, user=user)
        candidate_keys: set[tuple[str, str]] = set()
        for conversation in queryset:
            candidate_keys |= SpeakingRepository._clip_keys(conversation)

        deleted, _ = queryset.delete()
        if deleted and candidate_keys:
            SpeakingRepository._prune_orphan_clips(candidate_keys)
        return deleted

    # ── Analyses ──────────────────────────────────────────────────────────
    @staticmethod
    def create_analysis(**fields):
        return SpeakingAnalysis.objects.create(**fields)

    @staticmethod
    def recent_analyses(user, limit=30):
        return SpeakingAnalysis.objects.filter(user=user)[:limit]

    # ── Audio clip cache ──────────────────────────────────────────────────
    @staticmethod
    def get_clip(voice, text_hash):
        return SpeakingAudioClip.objects.filter(voice=voice, text_hash=text_hash).first()

    @staticmethod
    def get_or_create_clip(*, voice, text_hash, text, audio, mime_type):
        clip, _ = SpeakingAudioClip.objects.get_or_create(
            voice=voice,
            text_hash=text_hash,
            defaults={"text": text, "audio": audio, "mime_type": mime_type},
        )
        return clip

    @staticmethod
    def hash_text(text):
        return SpeakingAudioClip.hash_text(text)

    # ── AI response cache ─────────────────────────────────────────────────
    @staticmethod
    def remember_response(context, parts, producer):
        """Return the cached AI response for ``(context, parts)`` or compute it."""
        return AiResponseCache.remember(context, parts, producer)

    # ── Cross-aggregate reads (vocabulary / term matching) ────────────────
    @staticmethod
    def vocabulary_words(user, recent=20, total=100):
        """Up to ``total`` of the user's own term names, most-recent first.

        The first ``recent`` are the most recently revised/learned terms; the
        rest are random other owned terms. The list is de-duplicated while
        preserving order.
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

    @staticmethod
    def owned_terms(user):
        """``(id, name, deck_id)`` for every term in a deck the user owns."""
        return Term.objects.filter(deck__owner=user).values("id", "name", "deck_id")

    # ── Internals ─────────────────────────────────────────────────────────
    @staticmethod
    def _clip_keys(conversation):
        """``(voice, text_hash)`` pairs for every spoken line of a conversation."""
        voice = conversation.voice or ""
        if not voice:
            return set()
        keys = set()
        for line in conversation.lines or []:
            text = (line.get("text") or "").strip() if isinstance(line, dict) else ""
            if text:
                keys.add((voice, SpeakingAudioClip.hash_text(text)))
        return keys

    @staticmethod
    def _prune_orphan_clips(candidate_keys):
        """Delete cached clips in ``candidate_keys`` no surviving conversation uses."""
        voices = {voice for voice, _ in candidate_keys}
        referenced: set[tuple[str, str]] = set()
        survivors = SpeakingConversation.objects.filter(voice__in=voices).only("voice", "lines")
        for conversation in survivors.iterator():
            referenced |= SpeakingRepository._clip_keys(conversation)

        orphans = candidate_keys - referenced
        for voice in voices:
            hashes = [text_hash for clip_voice, text_hash in orphans if clip_voice == voice]
            if hashes:
                SpeakingAudioClip.objects.filter(voice=voice, text_hash__in=hashes).delete()

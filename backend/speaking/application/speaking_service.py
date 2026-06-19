"""Speaking Coach orchestration service.

Coordinates the AI coach (:class:`SpeakingCoachService`), the response cache and
persistence (:class:`SpeakingRepository`) for every Speaking Coach use case.
The DRF viewset is a thin transport layer that only parses requests, serializes
results and maps exceptions — all rules and data access live here.
"""

import re
from typing import Any

from backend.models import SpeakingAnalysis
from backend.speaking import topics as speaking_topics
from backend.speaking.application.services import (
    ACTIVE_TTS_VOICES,
    DEFAULT_TTS_VOICE,
    ELEVENLABS_ACCENT_DEFAULT,
    ELEVENLABS_VOICE_ACCENT,
    GEMINI_TTS_VOICES,
    TTS_VOICES,
    SpeakingCoachService,
)
from backend.speaking.infrastructure.repository import SpeakingRepository

_DEFAULT_FALLBACK_TOPICS = ["Ordering Coffee", "Job Interview", "Airport Check-in", "Making Plans", "At the Doctor"]


class SpeakingService:
    def __init__(
        self,
        coach: SpeakingCoachService,
        repo: type[SpeakingRepository] | SpeakingRepository = SpeakingRepository,
    ):
        self._coach = coach
        self._repo = repo

    # ── Conversation generation ───────────────────────────────────────────
    def generate_conversation(
        self,
        user,
        *,
        topic: str = "",
        accent: str = "US",
        user_name: str = "Me",
        partner_name: str = "Coach",
        custom_text: str | None = None,
        level: str | None = None,
        tone: str | None = None,
        turns: int = 6,
        voice: str | None = None,
        use_vocabulary: bool = False,
    ):
        vocabulary = self._repo.vocabulary_words(user) if use_vocabulary else None

        def _produce():
            return self._coach.generate_conversation(
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

        if vocabulary:
            # Inputs are randomized per request and we want variety, so skip the
            # response cache for vocabulary practice.
            conversation = _produce()
        else:
            # Reuse the AI output for an identical request instead of re-billing
            # the provider; a fresh history record is still created below.
            conversation = self._repo.remember_response(
                "conversation",
                [topic, accent, user_name, partner_name, custom_text, level, tone, turns],
                _produce,
            )

        return self._repo.create_conversation(
            user=user,
            topic=conversation["topic"],
            context=conversation["context"],
            accent=accent or "",
            level=level or "",
            tone=tone or "",
            voice=self._clean_active_voice(voice),
            lines=conversation["lines"],
        )

    def suggest_topics(self, history: list[str] | None = None, level: str | None = None) -> list[str]:
        topics = speaking_topics.random_for_level(level=level, exclude=history or [], limit=5)
        # Fall back to the AI suggester only if the topics file is empty/missing.
        if not topics:
            topics = self._coach.suggest_topics(history or [])
        return topics

    # ── Pronunciation analysis ────────────────────────────────────────────
    def analyze(
        self,
        user,
        *,
        target_text: str,
        audio: str,
        mime_type: str = "audio/webm",
        kind: str = SpeakingAnalysis.KIND_SINGLE,
        conversation_id: str | None = None,
    ):
        kind = (
            kind if kind in (SpeakingAnalysis.KIND_SINGLE, SpeakingAnalysis.KIND_FULL) else SpeakingAnalysis.KIND_SINGLE
        )
        result = self._coach.analyze_pronunciation(
            target_text, audio, mime_type=mime_type, full_session=(kind == SpeakingAnalysis.KIND_FULL)
        )
        conversation = self._repo.get_conversation(user, conversation_id) if conversation_id else None
        # Only the latest analysis per (user, conversation) is kept.
        self._repo.delete_analyses(user, conversation)
        record = self._repo.create_analysis(
            user=user,
            conversation=conversation,
            kind=kind,
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
        return record, result

    def analyze_text(
        self,
        *,
        target_text: str,
        audio: str,
        mime_type: str = "audio/wav",
        full_session: bool = False,
    ) -> dict[str, Any]:
        """Run pronunciation analysis and return the raw camelCase result only.

        Unlike :meth:`analyze`, this does not persist a ``SpeakingAnalysis`` record
        — used by other contexts (e.g. the Course role-play) that keep their own
        result history and must not pollute the Speaking Coach's.
        """
        return self._coach.analyze_pronunciation(target_text, audio, mime_type=mime_type, full_session=full_session)

    # ── Voices & speech ───────────────────────────────────────────────────
    def voices(self) -> dict[str, Any]:
        return {
            "voices": [
                {"id": v, "label": label, "accent": ELEVENLABS_VOICE_ACCENT.get(v)}
                for v, label in ACTIVE_TTS_VOICES.items()
            ],
            "default": DEFAULT_TTS_VOICE,
            "accent_defaults": ELEVENLABS_ACCENT_DEFAULT,
            "legacy_voices": [{"id": v, "label": label} for v, label in GEMINI_TTS_VOICES.items()],
        }

    def speak(self, text: str, voice: str | None):
        """Synthesize one line (cache-first) with the selected tutor voice."""
        voice = self._clean_playable_voice(voice)
        text_hash = self._repo.hash_text(text)
        clip = self._repo.get_clip(voice, text_hash)
        if clip is not None:
            return clip
        result = self._coach.synthesize_speech(text, voice)
        return self._repo.get_or_create_clip(
            voice=voice,
            text_hash=text_hash,
            text=text,
            audio=result["audio"],
            mime_type=result.get("mime_type", "audio/L16;rate=24000"),
        )

    def explain_phrase(self, text: str, context: str = "") -> dict[str, Any]:
        # Same word in the same line context returns identical guidance, so
        # re-opening a noted highlight is a cache hit (no extra AI call).
        return self._repo.remember_response(
            "explain_phrase",
            [text.lower(), (context or "").strip()],
            lambda: self._coach.explain_phrase(text, context),
        )

    # ── History ───────────────────────────────────────────────────────────
    def history(self, user):
        return self._repo.recent_conversations(user), self._repo.recent_analyses(user)

    def get_conversation(self, user, conversation_id):
        return self._repo.get_conversation(user, conversation_id)

    def delete_conversations(self, user, ids):
        return self._repo.delete_conversations(user, ids)

    def set_star(self, conversation, starred: bool | None):
        conversation.starred = (not conversation.starred) if starred is None else bool(starred)
        self._repo.save_conversation(conversation, ["starred", "updated_at"])
        return conversation

    def update_highlight(self, conversation, *, text: str, note: str = "", remove: bool = False):
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
        self._repo.save_conversation(conversation, ["highlights", "updated_at"])
        return highlights

    def match_terms(self, user, *, texts: list[str] | None = None, conversation_id: str | None = None):
        """The user's own terms that appear in a conversation's lines.

        Accepts either an explicit ``texts`` list or a ``conversation_id`` whose
        line texts are matched. When the same word lives in several decks the
        first one encountered wins.
        """
        if conversation_id and not isinstance(texts, list):
            conversation = self._repo.get_conversation(user, conversation_id)
            texts = [line.get("text", "") for line in (conversation.lines or [])] if conversation else []
        if not isinstance(texts, list):
            texts = []

        full_text = "\n".join(t for t in texts if isinstance(t, str)).lower()
        if not full_text.strip():
            return []

        words = set(re.findall(r"[a-z']+", full_text))
        matches = []
        seen = set()
        for term in self._repo.owned_terms(user):
            name = (term["name"] or "").strip()
            lowered = name.lower()
            if not lowered or lowered in seen:
                continue
            tokens = lowered.split()
            found = (lowered in words) if len(tokens) == 1 else (lowered in full_text)
            if found:
                seen.add(lowered)
                matches.append({"term_id": str(term["id"]), "deck_id": str(term["deck_id"]), "name": name})
        return matches

    # ── Voice validation ──────────────────────────────────────────────────
    @staticmethod
    def _clean_active_voice(value):
        """Validate a voice for a NEW conversation — only active voices allowed."""
        voice = value or DEFAULT_TTS_VOICE
        return voice if voice in ACTIVE_TTS_VOICES else DEFAULT_TTS_VOICE

    @staticmethod
    def _clean_playable_voice(value):
        """Validate a voice for playback — any recognized (active or legacy) voice."""
        voice = value or DEFAULT_TTS_VOICE
        return voice if voice in TTS_VOICES else DEFAULT_TTS_VOICE

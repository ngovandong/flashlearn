"""Speaking Coach orchestration service.

Coordinates the AI coach (:class:`SpeakingCoachService`), the response cache and
persistence (:class:`SpeakingRepository`) for every Speaking Coach use case.
The DRF viewset is a thin transport layer that only parses requests, serializes
results and maps exceptions — all rules and data access live here.
"""

import base64
import logging
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
    VOICE_DEMO_TEXT,
    SpeakingCoachService,
    audio_clip_public_id,
)
from backend.speaking.infrastructure.repository import SpeakingRepository

logger = logging.getLogger(__name__)

_DEFAULT_FALLBACK_TOPICS = ["Ordering Coffee", "Job Interview", "Airport Check-in", "Making Plans", "At the Doctor"]


class SpeakingService:
    def __init__(
        self,
        coach: SpeakingCoachService,
        repo: type[SpeakingRepository] | SpeakingRepository = SpeakingRepository,
        audio_storage=None,
    ):
        self._coach = coach
        self._repo = repo
        # When wired, synthesized audio is uploaded here and only its URL is
        # persisted; otherwise the base64 bytes are stored inline (legacy path).
        self._audio_storage = audio_storage

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
        audio_b64 = result["audio"]
        audio_url = self._upload_audio(voice, text_hash, audio_b64)
        return self._repo.get_or_create_clip(
            voice=voice,
            text_hash=text_hash,
            text=text,
            # Only keep base64 inline when the upload didn't happen (no storage
            # wired or it failed), so playback still works as a fallback.
            audio="" if audio_url else audio_b64,
            audio_url=audio_url,
            mime_type=result.get("mime_type", "audio/L16;rate=24000"),
        )

    def _upload_audio(self, voice: str, text_hash: str, audio_b64: str) -> str:
        """Upload base64 audio bytes to the audio store; return the URL (or "")."""
        if self._audio_storage is None or not audio_b64:
            return ""
        try:
            data = base64.b64decode(audio_b64)
            return self._audio_storage.upload_audio(data, public_id=audio_clip_public_id(voice, text_hash))
        except Exception:
            logger.exception("Audio upload failed for clip (%s); keeping inline base64", voice)
            return ""

    def explain_phrase(self, text: str, context: str = "") -> dict[str, Any]:
        # Same word in the same line context returns identical guidance, so
        # re-opening a noted highlight is a cache hit (no extra AI call).
        return self._repo.remember_response(
            "explain_phrase",
            [text.lower(), (context or "").strip()],
            lambda: self._coach.explain_phrase(text, context),
        )

    # ── Cache maintenance ─────────────────────────────────────────────────
    def prune_orphan_audio_clips(
        self, *, extra_referenced_keys=None, dry_run=False, delete_remote=False
    ) -> dict[str, Any]:
        """Delete cached TTS clips nothing references any more.

        The :class:`SpeakingAudioClip` cache is shared and never expires, so clips
        pile up when conversations are deleted or course dialogues are re-crawled.
        A clip is kept only when its ``(voice, text_hash)`` is still referenced by
        a saved conversation line, the per-voice picker demo, or one of
        ``extra_referenced_keys`` (e.g. course lesson lines, which reuse this
        cache). Everything else is an orphan.

        ``delete_remote`` also destroys each orphan's hosted Cloudinary asset (not
        just the DB row), so switching a course to a different TTS voice/engine
        reclaims the old audio. Pass ``dry_run=True`` to count orphans (and list
        each one's voice/text/size via ``previews``) without deleting. Returns
        ``{scanned, referenced, orphans, deleted, remote_deleted, previews}``.
        """
        referenced = self._referenced_clip_keys(extra_referenced_keys)

        scanned = 0
        orphans: list[tuple] = []  # (id, voice, text_hash)
        for clip_id, voice, text_hash in self._repo.clip_identity_rows():
            scanned += 1
            if (voice, text_hash) not in referenced:
                orphans.append((clip_id, voice, text_hash))

        orphan_ids = [o[0] for o in orphans]
        previews: list = []
        deleted = remote_deleted = 0
        if dry_run:
            previews = self._repo.clip_previews_by_ids(orphan_ids)
        else:
            if delete_remote and self._audio_storage is not None:
                for _id, voice, text_hash in orphans:
                    if self._delete_remote_audio(voice, text_hash):
                        remote_deleted += 1
            deleted = self._repo.delete_clips_by_ids(orphan_ids)
        return {
            "scanned": scanned,
            "referenced": len(referenced),
            "orphans": len(orphan_ids),
            "deleted": deleted,
            "remote_deleted": remote_deleted,
            "previews": previews,
        }

    def _delete_remote_audio(self, voice: str, text_hash: str) -> bool:
        """Best-effort delete of one clip's hosted audio asset."""
        try:
            return bool(self._audio_storage.delete_audio(audio_clip_public_id(voice, text_hash)))
        except Exception:  # noqa: BLE001 — never fail a prune on a CDN hiccup
            logger.exception("Failed to delete hosted audio for clip (%s)", voice)
            return False

    def migrate_audio_to_storage(self, *, max_clips=None, purge_audio=True, dry_run=False, on_progress=None) -> dict:
        """Upload clips still holding inline base64 to the audio store, one at a time.

        For each clip with no ``audio_url`` yet, the base64 bytes are decoded,
        uploaded and the resulting URL is saved; when ``purge_audio`` is set the
        inline base64 is then cleared to reclaim database space. Idempotent and
        re-runnable (already-migrated clips are skipped). Returns
        ``{pending, uploaded, failed, purged}``.
        """
        if self._audio_storage is None:
            raise RuntimeError("No audio storage is configured (set CLOUDINARY_* env vars).")

        if dry_run:
            return {"pending": self._repo.count_pending_upload(), "uploaded": 0, "failed": 0, "purged": purge_audio}

        ids = self._repo.pending_upload_ids(max_clips)
        uploaded = failed = 0
        for clip_id in ids:
            row = self._repo.clip_audio_row(clip_id)
            if not row or not row["audio"]:
                continue
            try:
                data = base64.b64decode(row["audio"])
                url = self._audio_storage.upload_audio(
                    data, public_id=audio_clip_public_id(row["voice"], row["text_hash"])
                )
            except Exception:
                logger.exception("Audio migration upload failed for clip %s", clip_id)
                url = ""
            if not url:
                failed += 1
                continue
            self._repo.set_clip_url(clip_id, url, purge_audio=purge_audio)
            uploaded += 1
            if on_progress:
                on_progress(uploaded, failed, len(ids))
        return {"pending": len(ids), "uploaded": uploaded, "failed": failed, "purged": purge_audio}

    def _referenced_clip_keys(self, extra_referenced_keys=None) -> set[tuple[str, str]]:
        """Every ``(voice, text_hash)`` a live feature can still replay."""
        keys: set[tuple[str, str]] = set(extra_referenced_keys or ())

        # The picker preview sample, pre-warmed for every recognized voice.
        demo_hash = self._repo.hash_text(VOICE_DEMO_TEXT)
        for voice in TTS_VOICES:
            keys.add((voice, demo_hash))

        # Each saved conversation line, keyed by the voice it replays with — the
        # same normalization the ``speak`` endpoint applies when caching.
        for voice, lines in self._repo.conversation_clip_sources():
            voice = self._clean_playable_voice(voice)
            for line in lines or []:
                if not isinstance(line, dict):
                    continue
                text = (line.get("text") or "").strip()
                if text:
                    keys.add((voice, self._repo.hash_text(text)))
        return keys

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

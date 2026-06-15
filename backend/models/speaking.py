import hashlib

from django.db import models

from base.models import DateTimeUUIDModel

from .user import User


class SpeakingConversation(DateTimeUUIDModel):
    """A generated Speaking Coach dialogue saved to a user's practice history."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="speaking_conversations")
    topic = models.CharField(max_length=255, blank=True)
    context = models.TextField(blank=True)
    accent = models.CharField(max_length=8, blank=True)
    level = models.CharField(max_length=8, blank=True)
    tone = models.CharField(max_length=32, blank=True)
    # [{"id", "speaker", "text"}, ...]
    lines = models.JSONField(default=list, blank=True)
    # User-noted words/phrases re-highlighted on revisit: [{"text", "note"}, ...]
    highlights = models.JSONField(default=list, blank=True)
    starred = models.BooleanField(default=False)
    voice = models.CharField(max_length=32, blank=True)

    class Meta:
        # Starred conversations float to the top, then most recent first.
        ordering = ["-starred", "-created_at"]


class SpeakingAudioClip(DateTimeUUIDModel):
    """Persistent cache of Gemini TTS audio for a ``(voice, text)`` pair.

    Shared across all users and conversations: because TTS is a billed call and
    a sentence renders identically every time, we synthesize each distinct line
    once and replay it forever. ``audio`` is base64-encoded PCM exactly as the
    provider returns it; the frontend decodes it with the Web Audio API.

    Gemini cannot emit per-line clips from a single multi-speaker call (it
    returns one merged blob), so the Speaking Coach generates audio per line and
    relies on this table plus a batch endpoint to keep it cheap and fast.
    """

    voice = models.CharField(max_length=32)
    text_hash = models.CharField(max_length=64, db_index=True)
    text = models.TextField()
    audio = models.TextField()
    mime_type = models.CharField(max_length=64, default="audio/L16;rate=24000")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["voice", "text_hash"], name="uniq_speaking_clip_voice_text"),
        ]

    @staticmethod
    def hash_text(text: str) -> str:
        return hashlib.sha256((text or "").strip().encode("utf-8")).hexdigest()


class SpeakingAnalysis(DateTimeUUIDModel):
    """A pronunciation analysis result saved to a user's practice history."""

    KIND_SINGLE = "single"
    KIND_FULL = "full"
    KIND_CHOICES = ((KIND_SINGLE, "Single sentence"), (KIND_FULL, "Full session"))

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="speaking_analyses")
    conversation = models.ForeignKey(
        SpeakingConversation, on_delete=models.SET_NULL, null=True, blank=True, related_name="analyses"
    )
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=KIND_SINGLE)
    target_text = models.TextField(blank=True)
    transcription = models.TextField(blank=True)
    accuracy_score = models.PositiveIntegerField(default=0)
    fluency_score = models.PositiveIntegerField(default=0)
    completeness_score = models.PositiveIntegerField(default=0)
    rhythm_score = models.PositiveIntegerField(default=0)
    words_per_minute = models.PositiveIntegerField(default=0)
    accent_analysis = models.TextField(blank=True)
    overall_feedback = models.TextField(blank=True)
    key_struggles = models.JSONField(default=list, blank=True)
    word_analysis = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-created_at"]

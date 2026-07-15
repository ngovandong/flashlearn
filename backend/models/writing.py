from django.db import models

from base.models import DateTimeUUIDModel

from .user import User


class WritingSession(DateTimeUUIDModel):
    """A Writing Coach practice session saved to a user's history.

    One unified record backs both modes:

    * ``chat`` — a back-and-forth conversation with the AI tutor. ``messages``
      holds the turns ``[{id, role, text, feedback}]``; ``feedback`` is only set
      on the user's turns (corrections, a better version, tips, examples).
    * ``freeform`` — a single written ``draft`` the user submits for review;
      ``feedback`` holds the inline corrections plus IELTS band scores.
    """

    MODE_CHAT = "chat"
    MODE_FREEFORM = "freeform"
    MODE_CHOICES = ((MODE_CHAT, "Chat"), (MODE_FREEFORM, "Free-form"))

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="writing_sessions")
    mode = models.CharField(max_length=16, choices=MODE_CHOICES, default=MODE_CHAT)
    topic = models.CharField(max_length=255, blank=True)
    level = models.CharField(max_length=8, blank=True)
    tone = models.CharField(max_length=32, blank=True)
    # Chat mode turns: [{"id", "role": "user"|"assistant", "text", "feedback"}].
    messages = models.JSONField(default=list, blank=True)
    # Free-form mode submitted draft.
    draft = models.TextField(blank=True)
    # Free-form mode review: {corrections, bands, overallBand, summary, ...}.
    feedback = models.JSONField(default=dict, blank=True)
    # User-noted words/phrases re-highlighted on revisit: [{"text", "note"}, ...].
    highlights = models.JSONField(default=list, blank=True)
    starred = models.BooleanField(default=False)

    class Meta:
        # Starred sessions float to the top, then most recent first.
        ordering = ["-starred", "-created_at"]

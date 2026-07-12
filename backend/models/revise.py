"""Mixed-review ("Revise") ledger.

The global Revise session interleaves items the learner already struggled with
across every feature — vocabulary, grammar, listening and speaking. Each row is
one reviewable item, keyed on a stable natural ``ref`` (never a content row FK)
so re-crawling/re-importing content never cascade-deletes a learner's revise
history.

A card is *seeded* from a feature's existing wrong signals (a low-scoring term,
a missed grammar blank, a mistyped dictation line, a poorly-pronounced sentence)
and then behaves like a lightweight spaced-repetition card: every wrong answer
raises its ``mistake_count`` and priority, a run of correct answers eventually
``mastered``s it and drops it from future sessions. This is what makes items the
learner got *completely wrong* or missed *repeatedly* surface first.
"""

from django.db import models

from base.models import DateTimeUUIDModel

from .user import User

# A card leaves the rotation once answered correctly this many times in a row.
REVISE_MASTERY_STREAK = 3


class ReviseCard(DateTimeUUIDModel):
    KIND_VOCAB = "vocab"
    KIND_GRAMMAR = "grammar"
    KIND_LISTENING = "listening"
    KIND_SPEAKING = "speaking"
    KIND_CHOICES = (
        (KIND_VOCAB, "Vocabulary"),
        (KIND_GRAMMAR, "Grammar"),
        (KIND_LISTENING, "Listening"),
        (KIND_SPEAKING, "Speaking"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="revise_cards")
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, db_index=True)
    # Stable natural identifier for the source item, namespaced by kind, e.g.
    # "term:<uuid>", "grammar:<exercise_key>#<item>", "listening:<key>#<pos>",
    # "speaking:<text_hash>". Unique per (user, kind).
    ref = models.CharField(max_length=255, db_index=True)

    # What the learner sees. ``answer`` is the canonical solution and is only
    # exposed to the client for choice-style cards (never for typed/spoken ones).
    prompt = models.TextField(blank=True)
    answer = models.TextField(blank=True)
    # Kind-specific render data (MCQ options, audio_url, blank count, …). Never
    # contains the hidden answer for typed cards.
    payload = models.JSONField(default=dict, blank=True)

    # How badly the source signal was missed when seeded (extra wrong blanks /
    # tokens / low accuracy). Feeds the initial priority so a completely-wrong
    # item outranks a nearly-right one.
    severity = models.PositiveIntegerField(default=1)
    mistake_count = models.PositiveIntegerField(default=0)
    correct_streak = models.PositiveIntegerField(default=0)
    seen_count = models.PositiveIntegerField(default=0)
    last_wrong_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    # Cached scheduling score (higher ⇒ shown sooner). Recomputed on every answer.
    priority = models.FloatField(default=0.0, db_index=True)
    mastered = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-priority", "-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "kind", "ref"], name="uniq_revise_card_user_kind_ref"),
        ]

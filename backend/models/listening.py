from django.db import models

from base.models import DateTimeUUIDModel

from .user import User


class ListeningTopic(DateTimeUUIDModel):
    """A themed collection of dictation (listen-and-type) exercises, e.g. "Conversations".

    Mirrors the way :class:`Course` groups lessons, but for the listening/dictation
    feature the hierarchy is flat (topic -> exercise) — there are no sections.
    """

    slug = models.SlugField(max_length=160, unique=True)
    title = models.CharField(max_length=255)
    level = models.CharField(max_length=16, blank=True)  # e.g. "A1-C1"
    description = models.TextField(blank=True)
    source = models.CharField(max_length=64, blank=True)  # provenance, e.g. "dailydictation"
    order = models.PositiveIntegerField(default=0)
    # Generated cover image for the topic card on the course catalog, hosted on
    # our Cloudinary (see the generate_listening_backgrounds command). Empty until
    # generated.
    background = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["order", "title"]


class ListeningExercise(DateTimeUUIDModel):
    """A single dictation exercise: an ordered list of sentences with per-sentence audio.

    The learner listens to each sentence and types what they hear; the frontend
    scores the typed text against ``sentences[].tokens`` (a word-level diff that
    accepts the tokenized alternatives, e.g. contractions). Per-sentence audio is
    mirrored to our CDN by the ``collect_listening_audio`` command.
    """

    topic = models.ForeignKey(ListeningTopic, on_delete=models.CASCADE, related_name="exercises")
    slug = models.SlugField(max_length=200)
    # Stable, globally-unique natural key ("{topic.slug}/{slug}"). User progress is
    # keyed on this (not the row UUID) so a clean re-crawl never loses progress.
    key = models.CharField(max_length=255, unique=True)
    title = models.CharField(max_length=255)
    level = models.CharField(max_length=16, blank=True)
    order = models.PositiveIntegerField(default=0)
    # The source lesson id (provenance / debugging).
    source_id = models.CharField(max_length=64, blank=True)
    # Full-exercise audio URL (mirrored to our CDN, or the source URL as a fallback).
    full_audio_url = models.CharField(max_length=500, blank=True, default="")
    # [{"position", "text", "tokens", "audio_url", "source_audio_url", "audio_hosted",
    #   "time_start", "time_end", "hint", "explanation"}, ...]. ``tokens`` is the
    # per-slot transcript (each item is a string or a list of accepted alternatives)
    # driving both the reveal and the client-side evaluation.
    sentences = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["topic", "slug"], name="uniq_listening_exercise_slug"),
        ]


class ListeningProgress(DateTimeUUIDModel):
    """A user's progress on a single dictation exercise.

    Keyed on the exercise's stable ``exercise_key`` (not a row FK) so progress is
    retained across content clean-ups and re-crawls. An attempt flips the exercise
    to ``completed`` once its accuracy clears the dictation pass threshold;
    ``best_score`` keeps the highest attempt and ``last_result`` the latest
    breakdown (typed text + per-token correctness) so mistakes are re-highlighted
    on revisit.
    """

    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = ((STATUS_IN_PROGRESS, "In progress"), (STATUS_COMPLETED, "Completed"))

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="listening_progress")
    # Matches ListeningExercise.key. Stored as a plain string (no FK) so deleting and
    # recreating exercise rows during a re-crawl does not cascade-delete progress.
    exercise_key = models.CharField(max_length=255, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    best_score = models.PositiveIntegerField(default=0)
    attempts = models.PositiveIntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)
    # The most recent attempt, replayed when the user revisits an exercise:
    # {"score", "lines": [{"position", "target", "typed", "correct", "total",
    # "tokens_correct": [bool, ...]}], "at"}.
    last_result = models.JSONField(default=dict, blank=True)
    # User-noted words/phrases re-highlighted on revisit: [{"text", "note"}, ...].
    # Per-user (lives on progress) because exercise content is shared across users.
    highlights = models.JSONField(default=list, blank=True)
    # Per-sentence, per-user helpers keyed by sentence position (as a string):
    # {"<position>": {"translation": "...", "note": "..."}}. The translation is a
    # (possibly user-edited) native-language rendering; the note is a free-form
    # remark. Lives on progress because exercise content is shared across users.
    sentence_meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "exercise_key"], name="uniq_user_listening_exercise_key"),
        ]

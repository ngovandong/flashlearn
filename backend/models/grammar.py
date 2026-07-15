"""Grammar textbook models (e.g. "Essential Grammar in Use").

Mirrors the structured-curriculum shape of :mod:`backend.models.course` and
:mod:`backend.models.listening`: a book groups sections, a section groups units,
and a unit holds a reference explanation plus auto-graded exercises.

User progress is tracked at two granularities and both are keyed on the content's
stable natural ``key`` (never a row FK) so re-importing the book never
cascade-deletes progress:

* :class:`UserGrammarUnitProgress` — per lesson (unit) roll-up.
* :class:`UserGrammarExerciseProgress` — per exercise.
"""

from django.db import models

from base.models import DateTimeUUIDModel

from .user import User


class GrammarBook(DateTimeUUIDModel):
    """A grammar textbook, e.g. "Essential Grammar in Use"."""

    slug = models.SlugField(max_length=128, unique=True)
    title = models.CharField(max_length=255)
    level = models.CharField(max_length=16, blank=True)  # e.g. "A1-B1"
    description = models.TextField(blank=True)
    source = models.CharField(max_length=64, blank=True)  # provenance, e.g. "essential-grammar-in-use"
    order = models.PositiveIntegerField(default=0)
    # Generated cover image for the book card, hosted on our Cloudinary. Empty
    # until generated.
    background = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["order", "title"]


class GrammarSection(DateTimeUUIDModel):
    """A thematic part of a book, e.g. "Present", "Past", "Modals"."""

    book = models.ForeignKey(GrammarBook, on_delete=models.CASCADE, related_name="sections")
    slug = models.SlugField(max_length=160)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["book", "slug"], name="uniq_grammar_section_slug"),
        ]


class GrammarUnit(DateTimeUUIDModel):
    """A single lesson: a reference explanation plus its exercises.

    The ``explanation`` is the book's left-hand reference page, stored as ordered
    blocks ``[{"label": "A", "html": "...", "examples": ["..."]}, ...]``. The
    exercises are the right-hand practice page (see :class:`GrammarExercise`).
    """

    section = models.ForeignKey(GrammarSection, on_delete=models.CASCADE, related_name="units")
    slug = models.SlugField(max_length=200)
    # Stable, globally-unique natural key ("{book.slug}__{unit.slug}"). User
    # progress is keyed on this (not the row UUID) so a clean re-import never
    # loses progress. Double-underscore separated so it stays URL-safe as a
    # single route segment (slugs never contain underscores).
    key = models.CharField(max_length=255, unique=True)
    number = models.PositiveIntegerField(default=0)  # unit number in the book
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    # Reference explanation blocks: [{"label", "html", "examples": [...]}, ...].
    explanation = models.JSONField(default=list, blank=True)
    background = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["order", "number"]
        constraints = [
            models.UniqueConstraint(fields=["section", "slug"], name="uniq_grammar_unit_slug"),
        ]


class GrammarExercise(DateTimeUUIDModel):
    """An auto-graded practice task within a unit.

    ``kind`` selects the interaction (and how ``items`` are rendered/graded):

    * ``fill_blank`` — each item is a sentence with one or more ``___`` blanks.
    * ``choose`` — each item picks one of ``options``.
    * ``rewrite`` — each item is rewritten as a full sentence.
    * ``match`` — each item pairs a ``text`` (left) with one of ``options`` (right).
    * ``reorder`` — each item's shuffled tokens are put back into order.

    Each item carries the accepted ``answers`` (from the book's answer key). The
    answers are only sent to the client after a submission so they can't be
    peeked at — see the serializers and :meth:`GrammarService.submit_exercise`.
    """

    KIND_FILL_BLANK = "fill_blank"
    KIND_CHOOSE = "choose"
    KIND_REWRITE = "rewrite"
    KIND_MATCH = "match"
    KIND_REORDER = "reorder"
    KIND_CHOICES = (
        (KIND_FILL_BLANK, "Fill in the blank"),
        (KIND_CHOOSE, "Choose the correct option"),
        (KIND_REWRITE, "Rewrite the sentence"),
        (KIND_MATCH, "Match"),
        (KIND_REORDER, "Reorder"),
    )

    unit = models.ForeignKey(GrammarUnit, on_delete=models.CASCADE, related_name="exercises")
    slug = models.SlugField(max_length=200)
    # Stable, globally-unique natural key ("{unit.key}__{exercise.slug}").
    key = models.CharField(max_length=255, unique=True)
    title = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField(default=0)
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=KIND_FILL_BLANK)
    prompt = models.TextField(blank=True)  # instruction, e.g. "Write am / is / are."
    # Exercise-level options (used by ``choose``/``match`` when the choices are
    # shared across items), e.g. ["is", "are", "am"].
    options = models.JSONField(default=list, blank=True)
    # [{"text", "options"?, "answers": [<blank1>, ...]}, ...]. Each blank answer
    # is a string or a list of accepted alternatives.
    items = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["unit", "slug"], name="uniq_grammar_exercise_slug"),
        ]


class UserGrammarUnitProgress(DateTimeUUIDModel):
    """A user's roll-up progress on a single unit (lesson).

    Keyed on the unit's stable ``unit_key`` (no FK). The unit flips to
    ``completed`` once every exercise in it is completed; ``best_score`` keeps the
    highest average across the unit's exercises.
    """

    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = ((STATUS_IN_PROGRESS, "In progress"), (STATUS_COMPLETED, "Completed"))

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="grammar_unit_progress")
    unit_key = models.CharField(max_length=255, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    best_score = models.PositiveIntegerField(default=0)
    attempts = models.PositiveIntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)
    # {"score", "at"} — the latest roll-up snapshot.
    last_result = models.JSONField(default=dict, blank=True)
    # User-noted words/phrases re-highlighted on revisit: [{"text", "note"}, ...].
    highlights = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "unit_key"], name="uniq_user_grammar_unit_key"),
        ]


class UserGrammarExerciseProgress(DateTimeUUIDModel):
    """A user's progress on a single exercise.

    Keyed on the exercise's stable ``exercise_key`` (no FK). An attempt flips the
    exercise to ``completed`` once its accuracy clears the pass threshold;
    ``best_score`` keeps the highest attempt and ``last_result`` the latest
    per-item breakdown so mistakes are re-shown on revisit.
    """

    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = ((STATUS_IN_PROGRESS, "In progress"), (STATUS_COMPLETED, "Completed"))

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="grammar_exercise_progress")
    exercise_key = models.CharField(max_length=255, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    best_score = models.PositiveIntegerField(default=0)
    attempts = models.PositiveIntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)
    # The most recent attempt, replayed when the user revisits an exercise:
    # {"score", "results": [{"correct", "blanks": [bool, ...], "given": [...]}], "at"}.
    last_result = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "exercise_key"], name="uniq_user_grammar_exercise_key"),
        ]

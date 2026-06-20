from django.db import models

from base.models import DateTimeUUIDModel

from .user import User


class Course(DateTimeUUIDModel):
    """A structured, multi-section language course imported from an external curriculum."""

    slug = models.SlugField(max_length=128, unique=True)
    title = models.CharField(max_length=255)
    level = models.CharField(max_length=8, blank=True)  # e.g. A2 / B1
    description = models.TextField(blank=True)
    source = models.CharField(max_length=64, blank=True)  # provenance, e.g. "freecodecamp"
    order = models.PositiveIntegerField(default=0)
    # AI-generated cover/background image for the course card, hosted on our
    # Cloudinary (see the generate_course_backgrounds command). Empty until generated.
    background = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["order", "level", "title"]


class CourseSection(DateTimeUUIDModel):
    """A unit of a course (a freeCodeCamp "block"), e.g. "Learn Greetings at the Office"."""

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="sections")
    slug = models.SlugField(max_length=160)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["course", "slug"], name="uniq_course_section_slug"),
        ]


class CourseLesson(DateTimeUUIDModel):
    """A practiceable dialogue scene within a section.

    Maps to a source "dialogue" plus its follow-up tasks. The dialogue ``lines``
    drive listening and the Live Role-play; ``exercises`` are stored read-only.
    A lesson is only *passed* when a Live Role-play scores high enough — see
    ``COURSE_PASS_THRESHOLD`` in ``backend.course.domain.progress`` and the
    course progress service.
    """

    section = models.ForeignKey(CourseSection, on_delete=models.CASCADE, related_name="lessons")
    slug = models.SlugField(max_length=200)
    # Stable, globally-unique natural key from the source curriculum, e.g.
    # "b1-english-for-developers/learn-.../dialogue-1-...". User progress is keyed
    # on this (not the row UUID) so a clean re-crawl never loses progress.
    key = models.CharField(max_length=255, unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    # [{"name", "role", "voice", "images": {layer: url}}, ...]. ``images`` are the
    # character art layers mirrored to our Cloudinary; ``voice`` is the Azure
    # neural voice assigned to the character.
    characters = models.JSONField(default=list, blank=True)
    # [{"speaker", "text", "align", "voice"}, ...] — each line is voiced by its
    # speaker's character voice, synthesized once into the SpeakingAudioClip cache.
    lines = models.JSONField(default=list, blank=True)
    # Full URL of the scene background image, mirrored to our Cloudinary (falls
    # back to the source CDN URL if mirroring failed).
    background = models.CharField(max_length=500, blank=True, default="")
    # Read-only follow-up tasks: [{"kind", "prompt", "sentence", "answers"}, ...]
    exercises = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["section", "slug"], name="uniq_course_lesson_slug"),
        ]


class UserCourseLessonProgress(DateTimeUUIDModel):
    """A user's progress on a single lesson.

    Keyed on the lesson's stable ``lesson_key`` (not a row FK) so progress is
    retained across content clean-ups and re-crawls. The lesson flips to
    ``passed`` only when a Live Role-play attempt clears the course pass
    threshold; ``best_score`` keeps the highest attempt.
    """

    STATUS_IN_PROGRESS = "in_progress"
    STATUS_PASSED = "passed"
    STATUS_CHOICES = ((STATUS_IN_PROGRESS, "In progress"), (STATUS_PASSED, "Passed"))

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="course_lesson_progress")
    # Matches CourseLesson.key. Stored as a plain string (no FK) so deleting and
    # recreating lesson rows during a re-crawl does not cascade-delete progress.
    lesson_key = models.CharField(max_length=255, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    best_score = models.PositiveIntegerField(default=0)
    attempts = models.PositiveIntegerField(default=0)
    passed_at = models.DateTimeField(null=True, blank=True)
    # The most recent Live Role-play breakdown, replayed when the user revisits a
    # lesson: {"sessions": [{"id", "text", "result"}], "score", "passed",
    # "overall_feedback"}. Recorded audio is not persisted (it's a local blob).
    last_result = models.JSONField(default=dict, blank=True)
    # User-noted words/phrases re-highlighted on revisit: [{"text", "note"}, ...].
    # Per-user (lives on progress) because lesson content is shared across users.
    highlights = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "lesson_key"], name="uniq_user_course_lesson_key"),
        ]

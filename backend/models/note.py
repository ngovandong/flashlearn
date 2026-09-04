"""Cross-feature study notes.

One rich-text note per (user, target), where a target is a course lesson, a
listening exercise, a speaking or writing session, or a grammar unit. The note
body is a ProseMirror/TipTap document (see ``backend.note.domain.document``)
rather than HTML, so it can be validated against a fixed schema on the way in
and rendered natively by both the web app and the Expo app.
"""

from django.db import models

from base.models import DateTimeUUIDModel

from .user import User


class Note(DateTimeUUIDModel):
    TARGET_COURSE_LESSON = "course_lesson"
    TARGET_LISTENING_EXERCISE = "listening_exercise"
    TARGET_SPEAKING_SESSION = "speaking_session"
    TARGET_WRITING_SESSION = "writing_session"
    TARGET_GRAMMAR_UNIT = "grammar_unit"
    TARGET_CHOICES = (
        (TARGET_COURSE_LESSON, "Course lesson"),
        (TARGET_LISTENING_EXERCISE, "Listening exercise"),
        (TARGET_SPEAKING_SESSION, "Speaking session"),
        (TARGET_WRITING_SESSION, "Writing session"),
        (TARGET_GRAMMAR_UNIT, "Grammar unit"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notes")
    target_type = models.CharField(max_length=32, choices=TARGET_CHOICES, db_index=True)
    # The target's stable natural identifier: the ``key`` for shared curriculum
    # (course lesson, listening exercise, grammar unit) so re-imports never orphan
    # a note, and the row UUID for user-owned speaking/writing sessions.
    target_key = models.CharField(max_length=255, db_index=True)

    # ProseMirror document: {"type": "doc", "content": [...]}. Sanitized against
    # the node/mark allowlists before it is written.
    content = models.JSONField(default=dict, blank=True)
    # Flattened text of ``content``, derived server-side on every write so the
    # note body is searchable without walking the JSON.
    plain_text = models.TextField(blank=True)

    # Captured on every save so a note can name and link back to its target
    # without joining across five bounded contexts. Recording them now is what
    # makes a future cross-feature notes list possible — a title cannot be
    # recovered for a session the content team has since re-imported.
    title = models.CharField(max_length=200, blank=True)
    target_url = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "target_type", "target_key"], name="uniq_note_user_target"),
        ]
        indexes = [
            models.Index(fields=["user", "-updated_at"], name="idx_note_user_updated"),
        ]

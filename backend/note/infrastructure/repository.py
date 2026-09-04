"""Persistence for cross-feature study notes.

Every read and write is scoped to the owning user, so a note is unreachable
with another user's credentials even when the target key is guessable.
"""

from backend.models import Note


class NoteRepository:
    @staticmethod
    def get(user, target_type, target_key):
        return Note.objects.filter(user=user, target_type=target_type, target_key=target_key).first()

    @staticmethod
    def upsert(user, target_type, target_key, *, content, plain_text, title, target_url):
        """Create or overwrite the user's note for a target and return it."""
        note, _ = Note.objects.update_or_create(
            user=user,
            target_type=target_type,
            target_key=target_key,
            defaults={
                "content": content,
                "plain_text": plain_text,
                "title": title,
                "target_url": target_url,
            },
        )
        return note

    @staticmethod
    def delete(user, target_type, target_key):
        """Remove the note for a target. Returns whether a row was deleted."""
        deleted, _ = Note.objects.filter(user=user, target_type=target_type, target_key=target_key).delete()
        return bool(deleted)

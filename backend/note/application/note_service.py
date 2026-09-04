"""Study-notes use cases.

A note is identified by what it is attached to — ``(user, target_type,
target_key)`` — rather than by an id the client has to keep, so the editor on a
lesson page can load and save without a create/update distinction. Saving an
empty document deletes the note, which is what keeps the panel's collapsed
"Add a note" state honest.

Images are re-hosted on our own CDN before they can be referenced. Uploading is
a separate step from saving, so by the time a document arrives every ``src`` in
it already points somewhere permanent.
"""

import hashlib

from backend.models import Note
from backend.note.domain import document
from backend.note.infrastructure.repository import NoteRepository
from backend.shared.application.exceptions import ValidationError

TARGET_TYPES = frozenset(choice[0] for choice in Note.TARGET_CHOICES)
MAX_TITLE_LENGTH = 200
MAX_URL_LENGTH = 500

# Notes are a study aid, not an album — a phone screenshot sits far under this.
MAX_IMAGE_BYTES = 5 * 1024 * 1024
_IMAGE_URL_SCHEMES = ("http://", "https://")


class NoteService:
    def __init__(self, *, repo=NoteRepository, image_storage=None, image_url_prefixes=()):
        self._repo = repo
        self._image_storage = image_storage
        # URL prefixes a note's images may point at (our CDN). Anything else is
        # dropped when a document is sanitized.
        self._image_url_prefixes = tuple(prefix for prefix in image_url_prefixes if prefix)

    def get(self, user, target_type, target_key):
        """The user's note for a target, or ``None``."""
        target_type, target_key = self._validate_target(target_type, target_key)
        return self._repo.get(user, target_type, target_key)

    def save(self, user, target_type, target_key, *, content, title="", target_url=""):
        """Write the note for a target; returns the note, or ``None`` if emptied.

        ``content`` is rebuilt from the allowed schema and the searchable plain
        text is derived here rather than trusted from the client.
        """
        target_type, target_key = self._validate_target(target_type, target_key)
        sanitized = document.sanitize(content, allowed_image_prefixes=self._image_url_prefixes)
        if document.is_empty(sanitized):
            self._repo.delete(user, target_type, target_key)
            return None
        return self._repo.upsert(
            user,
            target_type,
            target_key,
            content=sanitized,
            plain_text=document.to_plain_text(sanitized),
            title=(title or "").strip()[:MAX_TITLE_LENGTH],
            target_url=(target_url or "").strip()[:MAX_URL_LENGTH],
        )

    def upload_image(self, *, file=None, source_url=None):
        """Host an image for a note and return its URL.

        Accepts either pasted/picked image bytes or the URL of an image copied
        from a web page. A remote URL is fetched by the storage provider rather
        than by us, so a crafted address cannot reach our own network.
        """
        if self._image_storage is None:
            raise ValidationError("Image uploads are not configured.")
        if file is not None:
            return self._image_storage.upload_bytes(self._read_image(file))

        source_url = (source_url or "").strip()
        if not source_url.startswith(_IMAGE_URL_SCHEMES):
            raise ValidationError("Please provide an image file or an http(s) image address.")
        # A deterministic id keeps re-pasting the same picture from re-fetching it.
        public_id = f"notes/{hashlib.sha256(source_url.encode('utf-8')).hexdigest()[:32]}"
        return self._image_storage.mirror_url(source_url, public_id)

    # ── Internals ─────────────────────────────────────────────────────────
    @staticmethod
    def _read_image(file):
        if getattr(file, "size", 0) > MAX_IMAGE_BYTES:
            raise ValidationError("That image is too large — please keep it under 5 MB.")
        if not (getattr(file, "content_type", "") or "").startswith("image/"):
            raise ValidationError("That file is not an image.")
        data = file.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise ValidationError("That image is too large — please keep it under 5 MB.")
        return data

    @staticmethod
    def _validate_target(target_type, target_key):
        if target_type not in TARGET_TYPES:
            raise ValidationError("Unknown note target type.")
        target_key = (target_key or "").strip()
        if not target_key:
            raise ValidationError("Missing note target.")
        return target_type, target_key

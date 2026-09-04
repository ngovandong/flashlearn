from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..serializers.note import NoteSerializer
from ..services import note_service


class NoteViewSet(viewsets.ViewSet):
    """Rich-text study notes attached to lessons, exercises and coach sessions.

    Thin transport layer — the document schema, the empty-note-deletes rule and
    ownership all live in :class:`NoteService` and its repository.
    """

    permission_classes = (permissions.IsAuthenticated,)

    @action(detail=False, methods=["GET"])
    def for_target(self, request, *args, **kwargs):
        """The note for one target (``?target_type=&target_key=``).

        Returns ``{"note": null}`` when nothing has been written yet, which is
        how the panel decides to render collapsed.
        """
        note = note_service.get(
            request.user,
            request.query_params.get("target_type"),
            request.query_params.get("target_key"),
        )
        return Response({"note": NoteSerializer(note).data if note is not None else None})

    @action(detail=False, methods=["POST"], url_path="image")
    def upload_image(self, request, *args, **kwargs):
        """Host an image for a note and return ``{"url": ...}``.

        Send either an ``image`` file (pasted, dropped or picked) or a
        ``source_url`` for a picture copied from a web page. Editors call this
        before inserting, because a document is only stored with images that
        already live on our own CDN.
        """
        url = note_service.upload_image(
            file=request.FILES.get("image"),
            source_url=request.data.get("source_url"),
        )
        return Response({"url": url})

    def create(self, request, *args, **kwargs):
        """Save the note for a target (upsert).

        Body: ``{target_type, target_key, content, title?, target_url?}``. An
        empty document deletes the note and returns ``{"note": null}``.
        """
        note = note_service.save(
            request.user,
            request.data.get("target_type"),
            request.data.get("target_key"),
            content=request.data.get("content"),
            title=request.data.get("title") or "",
            target_url=request.data.get("target_url") or "",
        )
        return Response({"note": NoteSerializer(note).data if note is not None else None})

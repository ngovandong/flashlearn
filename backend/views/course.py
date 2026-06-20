from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..permissions import IsSuperUser
from ..serializers import CourseDetailSerializer, CourseSummarySerializer
from ..services import course_service
from ..shared.infrastructure.ai import AiProviderError
from ..shared.interfaces.pagination import CoursePageNumberPagination


class CourseViewSet(viewsets.ViewSet):
    """Structured English courses: catalog, content and Live Role-play scoring.

    Thin transport layer — parsing, serialization and error mapping only. All
    rules and data access live in :class:`CourseService` and its repository.
    """

    permission_classes = (permissions.IsAuthenticated,)
    lookup_value_regex = "[^/]+"

    def get_permissions(self):
        # Deleting a course is admin-only; everything else just needs a session.
        if self.action == "destroy":
            return [permissions.IsAuthenticated(), IsSuperUser()]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        # Optionally filter by level, paginate, then build the user's progress
        # summary for just that page (10 per page) so we never load every course.
        level = (request.query_params.get("level") or "").strip()
        paginator = CoursePageNumberPagination()
        page = paginator.paginate_queryset(
            course_service.list_courses_queryset(level=level or None), request, view=self
        )
        summaries = course_service.catalog(request.user, page)
        return paginator.get_paginated_response(CourseSummarySerializer(summaries, many=True).data)

    @action(detail=False, methods=["GET"])
    def levels(self, request, *args, **kwargs):
        """Distinct course levels for the catalog's level filter: ``{"levels": [...]}``."""
        return Response({"levels": course_service.available_levels()})

    def destroy(self, request, pk=None, *args, **kwargs):
        course_service.delete_course(pk)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def retrieve(self, request, pk=None, *args, **kwargs):
        detail = course_service.course_detail(request.user, pk)
        serializer = CourseDetailSerializer(
            detail["course"],
            context={"sections": detail["sections"], "progress": detail["progress"]},
        )
        return Response(serializer.data)

    @action(detail=False, methods=["GET"])
    def lesson_audio(self, request, *args, **kwargs):
        """Per-line generated character clips: ``{"lines": [{voice, text, audio, mime_type}]}``."""
        lesson = course_service.get_lesson(request.query_params.get("lesson_id"))
        return Response({"lines": course_service.lesson_audio(lesson)})

    @action(detail=False, methods=["POST"])
    def role_play(self, request, *args, **kwargs):
        """Score a Live Role-play recording sentence-by-sentence and update progress.

        ``segments`` is ``[{target_text, audio, mime_type}]`` — one per spoken line.
        """
        lesson_id = request.data.get("lesson_id")
        segments = request.data.get("segments")
        if not lesson_id:
            return Response({"errors": "Missing lesson."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(segments, list) or not segments:
            return Response({"errors": "Please record your audio first."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            outcome = course_service.submit_role_play(
                request.user,
                lesson_id=lesson_id,
                segments=segments,
            )
        except AiProviderError as exc:
            return Response({"errors": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        progress = outcome["progress"]
        return Response(
            {
                "score": outcome["score"],
                "passed": outcome["passed"],
                "threshold": outcome["threshold"],
                "sessions": outcome["sessions"],
                "progress": {
                    "status": progress.status,
                    "best_score": progress.best_score,
                    "attempts": progress.attempts,
                    "passed_at": progress.passed_at,
                    "highlights": progress.highlights,
                },
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["POST"])
    def highlight(self, request, *args, **kwargs):
        """Add, update or remove a per-user noted word/phrase on a lesson."""
        lesson_id = request.data.get("lesson_id")
        text = (request.data.get("text") or "").strip()
        if not lesson_id:
            return Response({"errors": "Missing lesson."}, status=status.HTTP_400_BAD_REQUEST)
        if not text:
            return Response({"errors": "Please enter some text."}, status=status.HTTP_400_BAD_REQUEST)
        highlights = course_service.set_lesson_highlight(
            request.user,
            lesson_id,
            text=text,
            note=(request.data.get("note") or "").strip(),
            remove=bool(request.data.get("remove")),
        )
        return Response({"highlights": highlights})

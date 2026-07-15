from rest_framework import serializers

from ..models import Course, CourseLesson, CourseSection


class _LessonProgressField(serializers.Serializer):
    """The requesting user's progress for a lesson, pulled from serializer context."""

    def to_representation(self, lesson):
        progress = (self.context.get("progress") or {}).get(lesson.key)
        if progress is None:
            return {
                "status": "not_started",
                "best_score": 0,
                "attempts": 0,
                "last_result": {},
                "highlights": [],
                "last_dictation": {},
            }
        return {
            "status": progress.status,
            "best_score": progress.best_score,
            "attempts": progress.attempts,
            "passed_at": progress.passed_at,
            "last_result": progress.last_result or {},
            "highlights": progress.highlights or [],
            "last_dictation": progress.last_dictation or {},
        }


class CourseLessonSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()
    has_audio = serializers.SerializerMethodField()

    class Meta:
        model = CourseLesson
        fields = [
            "id",
            "slug",
            "key",
            "title",
            "description",
            "order",
            "characters",
            "lines",
            "has_audio",
            "background",
            "exercises",
            "progress",
        ]

    def get_has_audio(self, lesson):
        # Audio exists once each line has a character voice assigned; the clips are
        # generated per voice + line text by the generate_course_audio command.
        return any((line or {}).get("voice") for line in (lesson.lines or []))

    def get_progress(self, lesson):
        return _LessonProgressField(context=self.context).to_representation(lesson)


class CourseSectionSerializer(serializers.ModelSerializer):
    lessons = serializers.SerializerMethodField()

    class Meta:
        model = CourseSection
        fields = ["id", "slug", "title", "description", "order", "lessons"]

    def get_lessons(self, section):
        return CourseLessonSerializer(section.lessons.all(), many=True, context=self.context).data


class CourseDetailSerializer(serializers.ModelSerializer):
    sections = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "slug", "title", "level", "description", "order", "background", "sections"]

    def get_sections(self, course):
        sections = self.context.get("sections") or []
        return CourseSectionSerializer(sections, many=True, context=self.context).data


class CourseSummarySerializer(serializers.Serializer):
    """Catalog row: a course plus the user's passed/total lesson counts."""

    id = serializers.UUIDField(source="course.id")
    slug = serializers.CharField(source="course.slug")
    title = serializers.CharField(source="course.title")
    level = serializers.CharField(source="course.level")
    description = serializers.CharField(source="course.description")
    order = serializers.IntegerField(source="course.order")
    background = serializers.CharField(source="course.background")
    total_lessons = serializers.IntegerField()
    passed_lessons = serializers.IntegerField()

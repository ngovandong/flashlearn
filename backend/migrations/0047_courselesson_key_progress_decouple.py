from django.db import migrations, models


def backfill_keys(apps, schema_editor):
    """Stamp every lesson with a stable global key and re-key existing progress.

    key = "<course_slug>/<section_slug>/<lesson_slug>" — globally unique because
    course slugs are unique and (section, slug) is unique within a course.
    """
    CourseLesson = apps.get_model("backend", "CourseLesson")
    Progress = apps.get_model("backend", "UserCourseLessonProgress")

    def key_for(lesson):
        course = lesson.section.course
        return f"{course.slug}/{lesson.section.slug}/{lesson.slug}"

    for lesson in CourseLesson.objects.select_related("section__course"):
        CourseLesson.objects.filter(pk=lesson.pk).update(key=key_for(lesson))

    for progress in Progress.objects.select_related("lesson__section__course"):
        if progress.lesson_id and progress.lesson:
            Progress.objects.filter(pk=progress.pk).update(lesson_key=key_for(progress.lesson))


class Migration(migrations.Migration):
    """Add the lesson natural key and decouple progress from the lesson FK.

    Progress is now keyed on the stable ``lesson_key`` string instead of the
    lesson row UUID, so cleaning + re-crawling course content never cascades away
    a user's role-play progress.
    """

    dependencies = [
        ("backend", "0046_courselesson_background"),
    ]

    operations = [
        migrations.AlterField(
            model_name="courselesson",
            name="background",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="courselesson",
            name="key",
            field=models.CharField(default="", max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="usercourselessonprogress",
            name="lesson_key",
            field=models.CharField(db_index=True, default="", max_length=255),
            preserve_default=False,
        ),
        migrations.RunPython(backfill_keys, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="usercourselessonprogress",
            name="uniq_user_course_lesson",
        ),
        migrations.RemoveField(
            model_name="usercourselessonprogress",
            name="lesson",
        ),
        migrations.AddConstraint(
            model_name="usercourselessonprogress",
            constraint=models.UniqueConstraint(fields=["user", "lesson_key"], name="uniq_user_course_lesson_key"),
        ),
        migrations.AlterField(
            model_name="courselesson",
            name="key",
            field=models.CharField(max_length=255, unique=True),
        ),
    ]

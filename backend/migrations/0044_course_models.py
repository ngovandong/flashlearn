import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import backend.shared.infrastructure.sqlalchemy.tables

# The user FK to backend_user is added separately because legacy tables in this
# database use the utf8mb3 charset while new tables inherit the server default
# (utf8mb4). MySQL rejects a foreign key whose column charset/collation differs
# from the referenced column, so we create user_id with backend_user.id's exact
# collation (mirrors migration 0039).
_USER_FK_TABLES = (("backend_usercourselessonprogress", "course_progress_user_id_fk"),)


def add_user_fk(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == "mysql":
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT CHARACTER_SET_NAME, COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'backend_user' AND COLUMN_NAME = 'id'"
            )
            charset, collation = cursor.fetchone()
            for table, fk_name in _USER_FK_TABLES:
                cursor.execute(
                    f"ALTER TABLE `{table}` "
                    f"ADD COLUMN `user_id` char(32) CHARACTER SET {charset} COLLATE {collation} NOT NULL"
                )
                cursor.execute(
                    f"ALTER TABLE `{table}` ADD CONSTRAINT `{fk_name}` "
                    f"FOREIGN KEY (`user_id`) REFERENCES `backend_user` (`id`)"
                )
        return

    # Non-MySQL fallback (e.g. local sqlite): add the FK column the normal way.
    model = apps.get_model("backend", "usercourselessonprogress")
    schema_editor.add_field(model, model._meta.get_field("user"))


def drop_user_fk(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == "mysql":
        with connection.cursor() as cursor:
            for table, fk_name in _USER_FK_TABLES:
                cursor.execute(f"ALTER TABLE `{table}` DROP FOREIGN KEY `{fk_name}`")
                cursor.execute(f"ALTER TABLE `{table}` DROP COLUMN `user_id`")
        return

    model = apps.get_model("backend", "usercourselessonprogress")
    schema_editor.remove_field(model, model._meta.get_field("user"))


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0043_speakingconversation_voice"),
    ]

    operations = [
        migrations.CreateModel(
            name="Course",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("slug", models.SlugField(max_length=128, unique=True)),
                ("title", models.CharField(max_length=255)),
                ("level", models.CharField(blank=True, max_length=8)),
                ("description", models.TextField(blank=True)),
                ("source", models.CharField(blank=True, max_length=64)),
                ("order", models.PositiveIntegerField(default=0)),
            ],
            options={
                "ordering": ["order", "level", "title"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.CreateModel(
            name="CourseAudioClip",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("filename", models.CharField(max_length=128, unique=True)),
                ("audio", models.TextField()),
                ("mime_type", models.CharField(default="audio/mpeg", max_length=64)),
            ],
            options={
                "abstract": False,
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.CreateModel(
            name="CourseLesson",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("slug", models.SlugField(max_length=200)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("order", models.PositiveIntegerField(default=0)),
                ("characters", models.JSONField(blank=True, default=list)),
                ("lines", models.JSONField(blank=True, default=list)),
                ("audio_filename", models.CharField(blank=True, max_length=128)),
                ("background", models.CharField(blank=True, max_length=128)),
                ("exercises", models.JSONField(blank=True, default=list)),
            ],
            options={
                "ordering": ["order"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.CreateModel(
            name="UserCourseLessonProgress",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("in_progress", "In progress"), ("passed", "Passed")],
                        default="in_progress",
                        max_length=16,
                    ),
                ),
                ("best_score", models.PositiveIntegerField(default=0)),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("passed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "lesson",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_progress",
                        to="backend.courselesson",
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.CreateModel(
            name="CourseSection",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("slug", models.SlugField(max_length=160)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("order", models.PositiveIntegerField(default=0)),
                (
                    "course",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="sections", to="backend.course"
                    ),
                ),
            ],
            options={
                "ordering": ["order"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.AddField(
            model_name="courselesson",
            name="section",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="lessons", to="backend.coursesection"
            ),
        ),
        # Add the user FK with the legacy-compatible collation (see module docstring).
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="usercourselessonprogress",
                    name="user",
                    field=models.ForeignKey(
                        default=None,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="course_lesson_progress",
                        to=settings.AUTH_USER_MODEL,
                    ),
                    preserve_default=False,
                ),
            ],
            database_operations=[
                migrations.RunPython(add_user_fk, drop_user_fk),
            ],
        ),
        migrations.AddConstraint(
            model_name="usercourselessonprogress",
            constraint=models.UniqueConstraint(fields=("user", "lesson"), name="uniq_user_course_lesson"),
        ),
        migrations.AddConstraint(
            model_name="coursesection",
            constraint=models.UniqueConstraint(fields=("course", "slug"), name="uniq_course_section_slug"),
        ),
        migrations.AddConstraint(
            model_name="courselesson",
            constraint=models.UniqueConstraint(fields=("section", "slug"), name="uniq_course_lesson_slug"),
        ),
    ]

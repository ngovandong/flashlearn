import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import backend.shared.infrastructure.sqlalchemy.tables

# The user FK to backend_user is added separately because legacy tables in this
# database use the utf8mb3 charset while new tables inherit the server default
# (utf8mb4). MySQL rejects a foreign key whose column charset/collation differs
# from the referenced column, so we create the user_id column with the *same*
# collation as backend_user.id, whatever it happens to be in this database.
_USER_FK_TABLES = (("backend_writingsession", "wrt_session_user_id_fk"),)


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
    model = apps.get_model("backend", "writingsession")
    schema_editor.add_field(model, model._meta.get_field("user"))


def drop_user_fk(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == "mysql":
        with connection.cursor() as cursor:
            for table, fk_name in _USER_FK_TABLES:
                cursor.execute(f"ALTER TABLE `{table}` DROP FOREIGN KEY `{fk_name}`")
                cursor.execute(f"ALTER TABLE `{table}` DROP COLUMN `user_id`")
        return

    model = apps.get_model("backend", "writingsession")
    schema_editor.remove_field(model, model._meta.get_field("user"))


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0050_speakingaudioclip_audio_url"),
    ]

    operations = [
        migrations.CreateModel(
            name="WritingSession",
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
                    "mode",
                    models.CharField(
                        choices=[("chat", "Chat"), ("freeform", "Free-form")],
                        default="chat",
                        max_length=16,
                    ),
                ),
                ("topic", models.CharField(blank=True, max_length=255)),
                ("level", models.CharField(blank=True, max_length=8)),
                ("tone", models.CharField(blank=True, max_length=32)),
                ("messages", models.JSONField(blank=True, default=list)),
                ("draft", models.TextField(blank=True)),
                ("feedback", models.JSONField(blank=True, default=dict)),
                ("highlights", models.JSONField(blank=True, default=list)),
                ("starred", models.BooleanField(default=False)),
            ],
            options={
                "ordering": ["-starred", "-created_at"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="writingsession",
                    name="user",
                    field=models.ForeignKey(
                        default=None,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="writing_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                    preserve_default=False,
                ),
            ],
            database_operations=[
                migrations.RunPython(add_user_fk, drop_user_fk),
            ],
        ),
    ]

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import backend.shared.infrastructure.sqlalchemy.tables


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0055_listeningprogress_sentence_meta"),
    ]

    operations = [
        migrations.CreateModel(
            name="GrammarBook",
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
                ("level", models.CharField(blank=True, max_length=16)),
                ("description", models.TextField(blank=True)),
                ("source", models.CharField(blank=True, max_length=64)),
                ("order", models.PositiveIntegerField(default=0)),
                ("background", models.CharField(blank=True, default="", max_length=500)),
            ],
            options={
                "ordering": ["order", "title"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.CreateModel(
            name="GrammarSection",
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
                    "book",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sections",
                        to="backend.grammarbook",
                    ),
                ),
            ],
            options={
                "ordering": ["order"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.CreateModel(
            name="GrammarUnit",
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
                ("key", models.CharField(max_length=255, unique=True)),
                ("number", models.PositiveIntegerField(default=0)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("order", models.PositiveIntegerField(default=0)),
                ("explanation", models.JSONField(blank=True, default=list)),
                ("background", models.CharField(blank=True, default="", max_length=500)),
                (
                    "section",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="units",
                        to="backend.grammarsection",
                    ),
                ),
            ],
            options={
                "ordering": ["order", "number"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.CreateModel(
            name="GrammarExercise",
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
                ("key", models.CharField(max_length=255, unique=True)),
                ("title", models.CharField(blank=True, max_length=255)),
                ("order", models.PositiveIntegerField(default=0)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("fill_blank", "Fill in the blank"),
                            ("choose", "Choose the correct option"),
                            ("rewrite", "Rewrite the sentence"),
                            ("match", "Match"),
                            ("reorder", "Reorder"),
                        ],
                        default="fill_blank",
                        max_length=16,
                    ),
                ),
                ("prompt", models.TextField(blank=True)),
                ("options", models.JSONField(blank=True, default=list)),
                ("items", models.JSONField(blank=True, default=list)),
                (
                    "unit",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="exercises",
                        to="backend.grammarunit",
                    ),
                ),
            ],
            options={
                "ordering": ["order"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.CreateModel(
            name="UserGrammarUnitProgress",
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
                ("unit_key", models.CharField(db_index=True, max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[("in_progress", "In progress"), ("completed", "Completed")],
                        default="in_progress",
                        max_length=16,
                    ),
                ),
                ("best_score", models.PositiveIntegerField(default=0)),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("last_result", models.JSONField(blank=True, default=dict)),
                ("highlights", models.JSONField(blank=True, default=list)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="grammar_unit_progress",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.CreateModel(
            name="UserGrammarExerciseProgress",
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
                ("exercise_key", models.CharField(db_index=True, max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[("in_progress", "In progress"), ("completed", "Completed")],
                        default="in_progress",
                        max_length=16,
                    ),
                ),
                ("best_score", models.PositiveIntegerField(default=0)),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("last_result", models.JSONField(blank=True, default=dict)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="grammar_exercise_progress",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.AddConstraint(
            model_name="grammarsection",
            constraint=models.UniqueConstraint(fields=("book", "slug"), name="uniq_grammar_section_slug"),
        ),
        migrations.AddConstraint(
            model_name="grammarunit",
            constraint=models.UniqueConstraint(fields=("section", "slug"), name="uniq_grammar_unit_slug"),
        ),
        migrations.AddConstraint(
            model_name="grammarexercise",
            constraint=models.UniqueConstraint(fields=("unit", "slug"), name="uniq_grammar_exercise_slug"),
        ),
        migrations.AddConstraint(
            model_name="usergrammarunitprogress",
            constraint=models.UniqueConstraint(fields=("user", "unit_key"), name="uniq_user_grammar_unit_key"),
        ),
        migrations.AddConstraint(
            model_name="usergrammarexerciseprogress",
            constraint=models.UniqueConstraint(fields=("user", "exercise_key"), name="uniq_user_grammar_exercise_key"),
        ),
    ]

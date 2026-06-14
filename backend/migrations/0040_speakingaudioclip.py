import uuid

from django.db import migrations, models

import backend.shared.infrastructure.sqlalchemy.tables


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0039_speakingconversation_speakinganalysis"),
    ]

    operations = [
        migrations.CreateModel(
            name="SpeakingAudioClip",
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
                ("voice", models.CharField(max_length=32)),
                ("text_hash", models.CharField(db_index=True, max_length=64)),
                ("text", models.TextField()),
                ("audio", models.TextField()),
                ("mime_type", models.CharField(default="audio/L16;rate=24000", max_length=64)),
            ],
            bases=(backend.shared.infrastructure.sqlalchemy.tables.SQLAlchemyTableMixin, models.Model),
        ),
        migrations.AddConstraint(
            model_name="speakingaudioclip",
            constraint=models.UniqueConstraint(fields=("voice", "text_hash"), name="uniq_speaking_clip_voice_text"),
        ),
    ]

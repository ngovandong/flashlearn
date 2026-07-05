# Generated for the Listening dictation per-sentence translation/note helpers.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0054_listeningtopic_background"),
    ]

    operations = [
        migrations.AddField(
            model_name="listeningprogress",
            name="sentence_meta",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

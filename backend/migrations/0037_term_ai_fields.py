from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0036_userlearningprogress_total_revisions"),
    ]

    operations = [
        migrations.RenameField(
            model_name="term",
            old_name="description",
            new_name="meaning",
        ),
        migrations.AddField(
            model_name="term",
            name="word_type",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="term",
            name="pronunciation",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="term",
            name="definition",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="term",
            name="synonyms",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="term",
            name="antonyms",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="term",
            name="examples",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="term",
            name="ai_filled",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]

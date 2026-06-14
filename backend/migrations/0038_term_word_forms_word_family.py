from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0037_term_ai_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="term",
            name="word_forms",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="term",
            name="word_family",
            field=models.JSONField(blank=True, default=list),
        ),
    ]

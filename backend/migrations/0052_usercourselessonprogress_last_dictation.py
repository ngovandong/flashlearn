from django.db import migrations, models


class Migration(migrations.Migration):
    """Persist the latest listen-and-type (dictation) attempt so the Course lesson
    page can replay the user's last dictation score and mistakes on revisit."""

    dependencies = [
        ("backend", "0051_writingsession"),
    ]

    operations = [
        migrations.AddField(
            model_name="usercourselessonprogress",
            name="last_dictation",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

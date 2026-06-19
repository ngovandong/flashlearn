from django.db import migrations, models


class Migration(migrations.Migration):
    """Persist the latest role-play breakdown and per-user lesson highlights so the
    Course lesson page can replay the last analysis and re-highlight noted words."""

    dependencies = [
        ("backend", "0048_course_background"),
    ]

    operations = [
        migrations.AddField(
            model_name="usercourselessonprogress",
            name="last_result",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="usercourselessonprogress",
            name="highlights",
            field=models.JSONField(blank=True, default=list),
        ),
    ]

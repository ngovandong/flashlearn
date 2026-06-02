from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0034_seed_user_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="learning_streak_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="user",
            name="last_study_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.RemoveField(
            model_name="userdeckrole",
            name="streaks",
        ),
    ]

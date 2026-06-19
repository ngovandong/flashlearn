from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0049_course_lesson_result_highlights"),
    ]

    operations = [
        migrations.AddField(
            model_name="speakingaudioclip",
            name="audio_url",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AlterField(
            model_name="speakingaudioclip",
            name="audio",
            field=models.TextField(blank=True),
        ),
    ]

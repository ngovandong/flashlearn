# Generated for Course.background

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0047_courselesson_key_progress_decouple"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="background",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
    ]

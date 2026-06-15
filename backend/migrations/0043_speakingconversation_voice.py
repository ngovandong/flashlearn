from django.db import migrations, models

DEFAULT_VOICE = "Kore"


def set_default_voice(apps, schema_editor):
    """Backfill existing conversations (created before the voice picker) with the
    default tutor voice. New records keep the blank default and get a voice from
    the UI on creation."""
    SpeakingConversation = apps.get_model("backend", "SpeakingConversation")
    SpeakingConversation.objects.filter(voice="").update(voice=DEFAULT_VOICE)


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0042_airesponsecache_speakingconversation_highlights_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="speakingconversation",
            name="voice",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.RunPython(set_default_voice, migrations.RunPython.noop),
    ]

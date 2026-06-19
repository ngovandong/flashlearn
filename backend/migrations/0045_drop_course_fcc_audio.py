from django.db import migrations


class Migration(migrations.Migration):
    """Drop the freeCodeCamp dialogue-audio store and lesson audio metadata.

    Course audio is now generated per line via Azure TTS and cached in the shared
    SpeakingAudioClip table, keyed by the character's voice + the line text, so
    the source CDN clips and their per-lesson references are no longer needed.
    """

    dependencies = [
        ("backend", "0044_course_models"),
    ]

    operations = [
        migrations.RemoveField(model_name="courselesson", name="audio_filename"),
        migrations.RemoveField(model_name="courselesson", name="background"),
        migrations.DeleteModel(name="CourseAudioClip"),
    ]

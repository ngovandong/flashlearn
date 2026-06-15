import hashlib
import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def _demo_hash():
    from backend.speaking.application.services import VOICE_DEMO_TEXT

    # Mirrors SpeakingAudioClip.hash_text (historical models drop custom methods).
    return hashlib.sha256(VOICE_DEMO_TEXT.strip().encode("utf-8")).hexdigest()


def create_voice_demo_clips(apps, schema_editor):
    """Pre-synthesize and cache the voice-preview sample for every tutor voice so
    the picker's demo plays instantly. Resilient: a provider/key/network failure
    skips that voice (and logs) instead of breaking the migration."""
    from backend.services import speaking_coach_service
    from backend.speaking.application.services import TTS_VOICES, VOICE_DEMO_TEXT

    SpeakingAudioClip = apps.get_model("backend", "SpeakingAudioClip")
    text_hash = _demo_hash()

    for voice in TTS_VOICES:
        if SpeakingAudioClip.objects.filter(voice=voice, text_hash=text_hash).exists():
            continue
        try:
            result = speaking_coach_service.synthesize_speech(VOICE_DEMO_TEXT, voice)
        except Exception:
            logger.exception("Could not pre-cache demo audio for voice %s", voice)
            continue
        SpeakingAudioClip.objects.get_or_create(
            voice=voice,
            text_hash=text_hash,
            defaults={
                "text": VOICE_DEMO_TEXT,
                "audio": result["audio"],
                "mime_type": result.get("mime_type", "audio/L16;rate=24000"),
            },
        )


def remove_voice_demo_clips(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0043_speakingconversation_voice"),
    ]

    operations = [
        migrations.RunPython(create_voice_demo_clips, remove_voice_demo_clips),
    ]

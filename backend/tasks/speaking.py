import logging
import os
import time

logger = logging.getLogger(__name__)

# How many uncached lines to synthesize per cron tick. The global AI gate already
# serializes TTS calls and caps them at the provider RPM; this just bounds how
# much of the backlog a single tick drains so the live ``speak`` endpoint isn't
# starved while warming up.
TTS_CRON_MAX_LINES = int(os.getenv("SPEAKING_TTS_CRON_MAX_LINES", "20"))

# Extra pause between synth calls (on top of the global rate limiter) so we stay
# comfortably under provider quotas and avoid the 502s a burst would trigger.
TTS_CRON_DELAY = float(os.getenv("SPEAKING_TTS_CRON_DELAY", "1.0"))

# Stop the run early after this many consecutive provider failures (the quota is
# almost certainly exhausted, so churning the rest of the backlog is pointless).
TTS_CRON_ABORT_AFTER_FAILURES = int(os.getenv("SPEAKING_TTS_CRON_ABORT_AFTER_FAILURES", "3"))


def _pending_lines(max_lines: int | None, voice_override: str | None = None):
    """Return up to ``max_lines`` distinct ``(voice, text, text_hash)`` conversation
    lines that have no cached :class:`SpeakingAudioClip` yet.

    Each conversation is warmed with the voice it was generated with (its
    ``voice`` field), falling back to the default voice when unset. Passing
    ``voice_override`` forces that voice for every line instead.
    """
    from ..models import SpeakingAudioClip, SpeakingConversation
    from ..speaking.application.services import DEFAULT_TTS_VOICE, TTS_VOICES, VOICE_DEMO_TEXT

    # Lazily load (and memoize) the set of already-cached hashes per voice.
    existing_by_voice: dict[str, set[str]] = {}

    def existing_for(voice: str) -> set[str]:
        if voice not in existing_by_voice:
            existing_by_voice[voice] = set(
                SpeakingAudioClip.objects.filter(voice=voice).values_list("text_hash", flat=True)
            )
        return existing_by_voice[voice]

    pending: list[tuple[str, str, str]] = []
    seen: set[tuple[str, str]] = set()

    def _add(voice: str, text: str) -> bool:
        """Queue ``(voice, text)`` if it isn't cached/queued. Returns True when the
        ``max_lines`` budget is now exhausted."""
        if voice not in TTS_VOICES:
            voice = DEFAULT_TTS_VOICE
        text = (text or "").strip()
        if not text:
            return False
        text_hash = SpeakingAudioClip.hash_text(text)
        key = (voice, text_hash)
        if text_hash in existing_for(voice) or key in seen:
            return False
        seen.add(key)
        pending.append((voice, text, text_hash))
        return max_lines is not None and len(pending) >= max_lines

    # Seed the per-voice preview sample first so the picker demo is always warm,
    # even for voices not used by any saved conversation. Retried each tick until
    # cached, so a transient rate-limit (429) self-heals over time.
    for demo_voice in [voice_override] if voice_override else TTS_VOICES:
        if _add(demo_voice, VOICE_DEMO_TEXT):
            return pending

    for conv_voice, lines in SpeakingConversation.objects.values_list("voice", "lines").iterator(chunk_size=200):
        voice = voice_override or conv_voice
        for line in lines or []:
            if not isinstance(line, dict):
                continue
            if _add(voice, line.get("text")):
                return pending
    return pending


def prewarm_speaking_audio(
    max_lines: int | None = TTS_CRON_MAX_LINES,
    voice: str | None = None,
    delay: float = TTS_CRON_DELAY,
    abort_after_failures: int | None = TTS_CRON_ABORT_AFTER_FAILURES,
) -> dict:
    """Pre-generate Speaking Coach TTS clips for conversation lines lacking a cache.

    The ``speak`` endpoint synthesizes one line on demand and caches the result
    in :class:`SpeakingAudioClip` keyed by ``(voice, text_hash)``. When many lines
    are requested at once it can hit the provider's per-minute quota and return
    502s. This cron drains the backlog slowly instead: it finds conversation
    lines that have no cached clip and synthesizes them **one at a time** (the
    global AI gate serializes calls; ``delay`` adds extra spacing on top).

    Each conversation is warmed with the voice it was generated with (the
    conversation's ``voice`` field, falling back to the default). Pass ``voice``
    to force a single voice for every line instead. It also seeds the per-voice
    picker preview sample so the demo is always warm. Idempotent: already-cached
    lines are skipped, so it is safe to re-run (a transient 429 self-heals on the
    next tick).
    """
    from ..models import SpeakingAudioClip
    from ..services import speaking_coach_service
    from ..shared.infrastructure.ai import AiProviderError
    from ..speaking.application.services import is_elevenlabs_voice

    pending = _pending_lines(max_lines, voice_override=voice)
    if not pending:
        return {"pending": 0, "synthesized": 0, "failed": 0, "aborted": False}

    synthesized = failed = 0
    consecutive_failures = 0
    aborted = False
    for index, (line_voice, text, text_hash) in enumerate(pending):
        try:
            result = speaking_coach_service.synthesize_speech(text, line_voice)
        except AiProviderError as exc:
            logger.warning("TTS prewarm failed for a line (%s)", exc)
            failed += 1
            consecutive_failures += 1
            if abort_after_failures and consecutive_failures >= abort_after_failures:
                logger.error(
                    "Aborting TTS prewarm after %d consecutive provider failures "
                    "(quota likely exhausted); re-run later.",
                    consecutive_failures,
                )
                aborted = True
                break
            continue
        except Exception:
            logger.exception("Unexpected error synthesizing a TTS prewarm line")
            failed += 1
            continue

        SpeakingAudioClip.objects.get_or_create(
            voice=line_voice,
            text_hash=text_hash,
            defaults={
                "text": text,
                "audio": result["audio"],
                "mime_type": result.get("mime_type", "audio/L16;rate=24000"),
            },
        )
        synthesized += 1
        consecutive_failures = 0

        # Only pace legacy Gemini lines — its TTS quota is tight, so this adds
        # spacing on top of the global gate. ElevenLabs has no such limit, so its
        # backlog is drained without any extra delay.
        if delay and index < len(pending) - 1 and not is_elevenlabs_voice(line_voice):
            time.sleep(delay)

    logger.info(
        "Speaking TTS prewarm: pending=%d synthesized=%d failed=%d aborted=%s",
        len(pending),
        synthesized,
        failed,
        aborted,
    )
    return {
        "pending": len(pending),
        "synthesized": synthesized,
        "failed": failed,
        "aborted": aborted,
    }

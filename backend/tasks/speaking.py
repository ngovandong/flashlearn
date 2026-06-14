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


def _pending_lines(voice: str, max_lines: int | None):
    """Return up to ``max_lines`` distinct ``(text, text_hash)`` conversation lines
    that have no cached :class:`SpeakingAudioClip` for ``voice`` yet."""
    from ..models import SpeakingAudioClip, SpeakingConversation

    existing = set(SpeakingAudioClip.objects.filter(voice=voice).values_list("text_hash", flat=True))

    pending: list[tuple[str, str]] = []
    seen: set[str] = set()
    for lines in SpeakingConversation.objects.values_list("lines", flat=True).iterator(chunk_size=200):
        for line in lines or []:
            if not isinstance(line, dict):
                continue
            text = (line.get("text") or "").strip()
            if not text:
                continue
            text_hash = SpeakingAudioClip.hash_text(text)
            if text_hash in existing or text_hash in seen:
                continue
            seen.add(text_hash)
            pending.append((text, text_hash))
            if max_lines is not None and len(pending) >= max_lines:
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

    Conversations don't store the chosen voice, so we warm the default voice
    (override per run with ``voice`` or the ``SPEAKING_TTS_CRON_*`` env vars).
    Idempotent: already-cached lines are skipped, so it is safe to re-run.
    """
    from ..models import SpeakingAudioClip
    from ..services import speaking_coach_service
    from ..shared.infrastructure.ai import AiProviderError
    from ..speaking.application.services import DEFAULT_TTS_VOICE, TTS_VOICES

    voice = voice if voice in TTS_VOICES else DEFAULT_TTS_VOICE

    pending = _pending_lines(voice, max_lines)
    if not pending:
        return {"voice": voice, "pending": 0, "synthesized": 0, "failed": 0, "aborted": False}

    synthesized = failed = 0
    consecutive_failures = 0
    aborted = False
    for index, (text, text_hash) in enumerate(pending):
        try:
            result = speaking_coach_service.synthesize_speech(text, voice)
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
            voice=voice,
            text_hash=text_hash,
            defaults={
                "text": text,
                "audio": result["audio"],
                "mime_type": result.get("mime_type", "audio/L16;rate=24000"),
            },
        )
        synthesized += 1
        consecutive_failures = 0

        # Space out the next call; the global gate already paces us, this is belt-and-suspenders.
        if delay and index < len(pending) - 1:
            time.sleep(delay)

    logger.info(
        "Speaking TTS prewarm: voice=%s pending=%d synthesized=%d failed=%d aborted=%s",
        voice,
        len(pending),
        synthesized,
        failed,
        aborted,
    )
    return {
        "voice": voice,
        "pending": len(pending),
        "synthesized": synthesized,
        "failed": failed,
        "aborted": aborted,
    }

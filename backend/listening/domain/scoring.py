"""Dictation scoring rules (pure — no Django, no I/O).

Typed answers are evaluated on the frontend (an instant word-level diff against
the transcript tokens); the backend only clamps the reported score and decides
whether an attempt completes the exercise.
"""

# A dictation attempt marks the exercise "completed" once accuracy reaches this.
DICTATION_PASS_THRESHOLD = 80


def clamp_score(value) -> int:
    """Coerce an arbitrary score into an integer percentage in ``[0, 100]``."""
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return 0


def is_complete(score: int) -> bool:
    return score >= DICTATION_PASS_THRESHOLD

"""Pure rules for course lesson progression (no Django, no I/O)."""

# A lesson is only marked "passed" when a Live Role-play attempt clears this
# average (accuracy + fluency + completeness) / 3 threshold.
COURSE_PASS_THRESHOLD = 80


def role_play_score(accuracy: int, fluency: int, completeness: int) -> int:
    """Overall Live Role-play score: the average of the three sub-scores."""
    return round((int(accuracy) + int(fluency) + int(completeness)) / 3)


def is_passing(score: int) -> bool:
    return int(score) >= COURSE_PASS_THRESHOLD

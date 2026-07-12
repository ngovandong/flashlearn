"""Revise scheduling rules (pure — no Django, no I/O).

The Revise session is a light spaced-repetition scheduler over a mixed pool of
cards. Its one job is to bubble up the items the learner keeps getting wrong, so
the priority formula is deliberately simple and explainable:

* ``severity`` — how badly the item was missed when seeded (a completely-wrong
  answer seeds higher than a near-miss).
* ``mistake_count`` — repeated mistakes dominate; this is the strongest signal.
* ``correct_streak`` — recent successes push a card down (and eventually master
  it) so a session doesn't loop on something already re-learned.
* recency — a card missed longer ago is nudged up so nothing is starved.

Everything here is deterministic given ``now`` and the card's counters, which
keeps it unit-testable without a database.
"""

from datetime import datetime

# Weights for the priority formula. Repeated mistakes are the loudest signal.
_W_SEVERITY = 1.0
_W_MISTAKE = 3.0
_W_STREAK = 2.5
# A card mastered (see below) is dropped from sessions entirely.
MASTERY_STREAK = 3
# Recency: full boost once a wrong answer is this many days old, linear before.
_RECENCY_FULL_DAYS = 14.0
_W_RECENCY = 2.0


def is_mastered(correct_streak: int) -> bool:
    """A card leaves the rotation after a short run of correct answers."""
    return correct_streak >= MASTERY_STREAK


def priority(
    *,
    severity: int,
    mistake_count: int,
    correct_streak: int,
    last_wrong_at: datetime | None,
    now: datetime,
) -> float:
    """Scheduling score for a card — higher is shown sooner.

    Never-missed-again cards with a long correct streak trend toward (and below)
    zero; a freshly, badly-missed item trends high.
    """
    score = _W_SEVERITY * max(0, severity)
    score += _W_MISTAKE * max(0, mistake_count)
    score -= _W_STREAK * max(0, correct_streak)

    if last_wrong_at is not None:
        age_days = max(0.0, (now - last_wrong_at).total_seconds() / 86400.0)
        score += _W_RECENCY * min(1.0, age_days / _RECENCY_FULL_DAYS)
    return score


def interleave(cards, key):
    """Reorder ``cards`` (already sorted by priority desc) so consecutive items
    rarely share a ``key`` (their kind).

    A round-robin across kinds keeps a session varied and fun instead of five
    vocab cards in a row, while still honouring priority *within* each kind.
    """
    buckets: dict = {}
    order: list = []
    for card in cards:
        k = key(card)
        if k not in buckets:
            buckets[k] = []
            order.append(k)
        buckets[k].append(card)

    result = []
    while any(buckets[k] for k in order):
        for k in order:
            if buckets[k]:
                result.append(buckets[k].pop(0))
    return result

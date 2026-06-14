"""Curated conversation topics loaded from ``topics.json``.

Topics are stored in a flat JSON file (no database table) and served by the
topic suggester, filtered by the learner's CEFR level. The file is read once and
cached in memory.
"""

import json
import random
from functools import lru_cache
from pathlib import Path

_TOPICS_FILE = Path(__file__).resolve().parent / "topics.json"


@lru_cache(maxsize=1)
def _all_topics() -> list[dict]:
    try:
        with _TOPICS_FILE.open(encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return []
    return [t for t in data if isinstance(t, dict) and t.get("text")]


def random_for_level(level: str | None = None, exclude=None, limit: int = 5) -> list[str]:
    """Random topic texts for ``level``, backfilling from other levels if sparse."""
    blocked = {e for e in (exclude or []) if e}
    topics = _all_topics()

    pool = [t["text"] for t in topics if t.get("level") == level and t["text"] not in blocked] if level else []
    chosen = random.sample(pool, min(limit, len(pool))) if pool else []

    if len(chosen) < limit:
        seen = blocked | set(chosen)
        backfill = [t["text"] for t in topics if t["text"] not in seen]
        random.shuffle(backfill)
        chosen += backfill[: limit - len(chosen)]

    return chosen

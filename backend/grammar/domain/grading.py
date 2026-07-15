"""Grammar exercise grading rules (pure — no Django, no I/O).

Unlike the dictation feature (which grades client-side), grammar answers are
graded on the server so the answer key is never shipped to the browser before a
submission. Every exercise kind is graded through one uniform contract:

* An exercise has ``items``; each item has ``answers`` — a list with one entry
  per blank/slot. Each entry is a string (one accepted answer) or a list of
  accepted alternatives.
* The client submits ``given`` — one list of typed strings per item, aligned to
  that item's blanks.

The score is the percentage of correct slots across the whole exercise; an
exercise is *completed* once it clears :data:`GRAMMAR_PASS_THRESHOLD`.
"""

import re

# An exercise attempt marks itself "completed" once accuracy reaches this.
GRAMMAR_PASS_THRESHOLD = 80

_WS = re.compile(r"\s+")


def normalize(value) -> str:
    """Canonicalize an answer for comparison.

    Lowercases, unifies curly apostrophes, collapses internal whitespace and
    trims surrounding spaces and terminal punctuation so that "He isn't French."
    matches "he isn't french" while a single-word answer like "is" is untouched.
    """
    text = str(value or "")
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    text = text.strip().lower()
    text = _WS.sub(" ", text)
    return text.strip(" .!?,;:")


def accepted_alternatives(blank) -> list[str]:
    """The list of accepted strings for a single blank/slot."""
    if isinstance(blank, list | tuple):
        return [str(alt) for alt in blank]
    return [str(blank)]


def blank_count(item) -> int:
    """How many blanks/slots an item has (drives how many inputs to render)."""
    return len(item.get("answers") or [])


def grade_item(item, given) -> dict:
    """Grade one item's ``given`` answers against its ``answers`` key.

    Returns ``{"blanks": [bool, ...], "correct": bool, "answers": [str, ...]}``
    where ``answers`` is the canonical (first) accepted answer per blank, used to
    reveal the solution after a submission.
    """
    answers = item.get("answers") or []
    given = given if isinstance(given, list) else [given]
    blanks = []
    canonical = []
    for index, blank in enumerate(answers):
        alternatives = accepted_alternatives(blank)
        canonical.append(alternatives[0] if alternatives else "")
        typed = given[index] if index < len(given) else ""
        accepted = {normalize(alt) for alt in alternatives}
        blanks.append(normalize(typed) in accepted)
    return {"blanks": blanks, "correct": all(blanks) if blanks else False, "answers": canonical}


def grade_exercise(items, submissions) -> dict:
    """Grade a whole exercise.

    ``items`` is the exercise's item list; ``submissions`` is a list aligned to
    it, each a list of typed strings. Returns the score (0-100), per-item results
    and whether the attempt completes the exercise.
    """
    submissions = submissions if isinstance(submissions, list) else []
    results = []
    total_slots = 0
    correct_slots = 0
    for index, item in enumerate(items or []):
        given = submissions[index] if index < len(submissions) else []
        result = grade_item(item, given)
        results.append({**result, "given": [str(g) for g in (given if isinstance(given, list) else [given])]})
        total_slots += len(result["blanks"])
        correct_slots += sum(1 for ok in result["blanks"] if ok)
    score = round(correct_slots / total_slots * 100) if total_slots else 0
    return {"score": score, "results": results, "completed": score >= GRAMMAR_PASS_THRESHOLD}

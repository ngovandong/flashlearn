"""Answer grading for typed/choice revise cards (pure — no Django, no I/O).

Speaking cards are graded by the pronunciation service (audio in, score out) and
so are handled in the application layer; everything text-based is graded here.
"""

import re

_WS = re.compile(r"\s+")


def normalize(value) -> str:
    """Canonicalize free text for a forgiving comparison.

    Lowercases, unifies curly apostrophes, collapses whitespace and trims
    surrounding punctuation — the same shape the grammar/dictation graders use so
    "He isn't French." matches "he isnt french".
    """
    text = str(value or "")
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    text = text.strip().lower()
    text = _WS.sub(" ", text)
    return text.strip(" .!?,;:\"'")


def accepted(answer) -> list[str]:
    """The accepted strings for one slot (a string, or a list of alternatives)."""
    if isinstance(answer, list | tuple):
        return [str(alt) for alt in answer]
    return [str(answer)]


def grade_choice(given, answer) -> bool:
    """A single-answer match (vocabulary MCQ / grammar choose)."""
    options = {normalize(alt) for alt in accepted(answer)}
    return normalize(given) in options


def grade_blanks(given, answers) -> dict:
    """Grade a list of typed blanks against their accepted answers.

    ``given`` is a list of typed strings aligned to ``answers`` (each a string or
    a list of alternatives). Returns ``{"blanks": [bool, ...], "correct": bool}``.
    """
    given = given if isinstance(given, list) else [given]
    blanks = []
    for index, answer in enumerate(answers or []):
        options = {normalize(alt) for alt in accepted(answer)}
        typed = given[index] if index < len(given) else ""
        blanks.append(normalize(typed) in options)
    return {"blanks": blanks, "correct": all(blanks) if blanks else False}


def grade_sentence(given, target) -> dict:
    """Grade a typed sentence (dictation) against the target, token by token.

    Returns ``{"correct": bool, "ratio": float}`` — ``correct`` is an exact
    normalized match; ``ratio`` is the fraction of target tokens typed correctly
    in order, so a near-miss can still be shown as "almost".
    """
    target_tokens = normalize(target).split()
    typed_tokens = normalize(given).split()
    if not target_tokens:
        return {"correct": False, "ratio": 0.0}
    hits = sum(1 for i, tok in enumerate(target_tokens) if i < len(typed_tokens) and typed_tokens[i] == tok)
    ratio = hits / len(target_tokens)
    return {"correct": ratio == 1.0 and len(typed_tokens) == len(target_tokens), "ratio": ratio}

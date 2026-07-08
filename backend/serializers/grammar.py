"""Serializers for the Grammar feature.

The catalog and unit-detail serializers deliberately strip the answer key from
exercise ``items`` — answers are only returned by the grade endpoint after a
submission (or replayed from a user's own past attempt via ``last_result``).
"""

import random

from rest_framework import serializers

from backend.grammar.domain.grading import accepted_alternatives, blank_count


def _unit_progress_payload(progress):
    if progress is None:
        return {"status": "not_started", "best_score": 0, "attempts": 0, "highlights": []}
    return {
        "status": progress.status,
        "best_score": progress.best_score,
        "attempts": progress.attempts,
        "completed_at": progress.completed_at,
        "highlights": progress.highlights or [],
    }


def _exercise_progress_payload(progress):
    if progress is None:
        return {"status": "not_started", "best_score": 0, "attempts": 0, "last_result": {}}
    return {
        "status": progress.status,
        "best_score": progress.best_score,
        "attempts": progress.attempts,
        "completed_at": progress.completed_at,
        "last_result": progress.last_result or {},
    }


def _public_item(kind, item):
    """A single item with the answer key removed (safe to send to the client)."""
    text = item.get("text") or ""
    answers = item.get("answers") or []
    if kind == "fill_blank":
        return {"text": text, "blanks": blank_count(item)}
    if kind == "choose":
        return {"text": text, "options": item.get("options") or []}
    if kind == "match":
        return {"text": text}
    if kind == "reorder":
        correct = accepted_alternatives(answers[0])[0] if answers else text
        tokens = correct.split()
        shuffled = tokens[:]
        if len(shuffled) > 1:
            # Shuffle until the order differs so the task isn't already solved.
            for _ in range(5):
                random.shuffle(shuffled)
                if shuffled != tokens:
                    break
        return {"tokens": shuffled}
    # rewrite (and any fallback): just the prompt sentence.
    return {"text": text}


class GrammarExercisePublicSerializer(serializers.Serializer):
    """An exercise ready for practice — items carry no answers."""

    def to_representation(self, exercise):
        progress = (self.context.get("progress") or {}).get(exercise.key)
        options = exercise.options or []
        if exercise.kind == "match":
            options = [o for o in options]
            random.shuffle(options)
        return {
            "id": exercise.id,
            "key": exercise.key,
            "slug": exercise.slug,
            "title": exercise.title,
            "order": exercise.order,
            "kind": exercise.kind,
            "prompt": exercise.prompt,
            "options": options,
            "items": [_public_item(exercise.kind, i) for i in (exercise.items or []) if isinstance(i, dict)],
            "progress": _exercise_progress_payload(progress),
        }


class GrammarUnitDetailSerializer(serializers.Serializer):
    """A unit's reference explanation + its (answer-stripped) exercises."""

    def to_representation(self, detail):
        unit = detail["unit"]
        return {
            "key": unit.key,
            "slug": unit.slug,
            "number": unit.number,
            "title": unit.title,
            "description": unit.description,
            "explanation": unit.explanation or [],
            "section": {"slug": unit.section.slug, "title": unit.section.title},
            "book": {"slug": unit.section.book.slug, "title": unit.section.book.title},
            "exercises": GrammarExercisePublicSerializer(
                detail["exercises"], many=True, context={"progress": detail["progress"]}
            ).data,
            "progress": _unit_progress_payload(detail.get("unit_progress")),
            "prev_key": detail.get("prev_key"),
            "next_key": detail.get("next_key"),
        }


class GrammarCatalogSerializer(serializers.Serializer):
    """The book with sections → units and the user's progress counts."""

    def to_representation(self, catalog):
        book = catalog["book"]
        sections = []
        for entry in catalog["sections"]:
            section = entry["section"]
            units = [
                {
                    "key": u["unit"].key,
                    "slug": u["unit"].slug,
                    "number": u["unit"].number,
                    "title": u["unit"].title,
                    "total_exercises": u["total_exercises"],
                    "completed_exercises": u["completed_exercises"],
                    "status": u["status"],
                    "best_score": u["best_score"],
                }
                for u in entry["units"]
            ]
            sections.append(
                {
                    "id": section.id,
                    "slug": section.slug,
                    "title": section.title,
                    "description": section.description,
                    "order": section.order,
                    "total_units": entry["total_units"],
                    "completed_units": entry["completed_units"],
                    "units": units,
                }
            )
        return {
            "book": {
                "slug": book.slug,
                "title": book.title,
                "level": book.level,
                "description": book.description,
                "background": book.background,
            },
            "sections": sections,
        }

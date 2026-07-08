"""Grammar feature orchestration service.

Coordinates the book/section/unit/exercise content (:class:`GrammarRepository`),
per-user progress at two granularities (unit + exercise), and server-side
grading (:mod:`backend.grammar.domain.grading`). The DRF viewset stays a thin
transport layer.
"""

import re

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from backend.grammar.domain import grading
from backend.grammar.infrastructure.repository import GrammarRepository
from backend.shared.application.exceptions import NotFoundError, ValidationError

# OCR/extraction tidy-ups for exercise item prompts.
_LEADING_ENUM = re.compile(r"^\s*\d{1,3}\s*[.)]?\s+")  # "1 ", "2. ", "12) "
_UNDERSCORES = re.compile(r"_{2,}")  # normalise every blank marker to exactly "___"


def _normalize_item_text(text):
    t = _UNDERSCORES.sub("___", str(text or ""))
    t = _LEADING_ENUM.sub("", t)
    return t.strip()


def _exercise_broken_items(exercise):
    """Items of ``exercise`` that would render no answerable input.

    With the renderer's rewrite-style fallback, a fill_blank item is fine as long
    as it has an answer key; choose/match additionally need options. Returns the
    list of bad items (empty ⇒ the exercise is fully usable).
    """
    bad = []
    for item in exercise.items or []:
        if not isinstance(item, dict):
            bad.append(item)
            continue
        answers = item.get("answers") or []
        if not answers:
            bad.append(item)
            continue
        if exercise.kind in ("choose", "match"):
            options = (item.get("options") or []) or (exercise.options or [])
            if not options:
                bad.append(item)
    return bad


class GrammarService:
    def __init__(self, *, repo=GrammarRepository):
        self._repo = repo

    # ── Books ─────────────────────────────────────────────────────────────
    def get_book(self, slug):
        return self._repo.get_book(slug)

    def list_books(self, user):
        """Every imported book with the user's unit-completion summary.

        Powers the book selector on the Grammar tab and Course tab so the
        feature scales to several books (grouped by source/title).
        """
        out = []
        for book in self._repo.list_books():
            unit_progress = self._repo.unit_progress_map(user, book)
            total_units = self._repo.count_units(book)
            completed_units = sum(1 for row in unit_progress.values() if row.status == row.STATUS_COMPLETED)
            out.append(
                {
                    "slug": book.slug,
                    "title": book.title,
                    "level": book.level,
                    "description": book.description,
                    "source": book.source,
                    "background": book.background,
                    "total_units": total_units,
                    "completed_units": completed_units,
                }
            )
        return out

    # ── Catalog ───────────────────────────────────────────────────────────
    def catalog(self, user, book_slug=None):
        """A book with its sections/units and the user's progress.

        ``book_slug`` selects the book (defaults to the first). Serves both the
        Grammar tab (full section→unit tree) and the Course "Grammar course" tab
        (per-section unit counts).
        """
        book = self._repo.get_book(book_slug) if book_slug else self._repo.first_book()
        if book is None:
            return None
        totals = self._repo.exercise_counts_for_book(book)
        unit_progress = self._repo.unit_progress_map(user, book)
        exercise_progress = self._repo.exercise_progress_map_for_book(user, book)

        sections = []
        for section in self._repo.sections_with_units(book):
            units = []
            completed_units = 0
            for unit in section.units.all():
                total_exercises = totals.get(unit.key, 0)
                completed_exercises = sum(
                    1
                    for key, row in exercise_progress.items()
                    if key.startswith(f"{unit.key}__") and row.status == row.STATUS_COMPLETED
                )
                up = unit_progress.get(unit.key)
                status = up.status if up is not None else "not_started"
                if status == "completed":
                    completed_units += 1
                units.append(
                    {
                        "unit": unit,
                        "total_exercises": total_exercises,
                        "completed_exercises": completed_exercises,
                        "status": status,
                        "best_score": up.best_score if up is not None else 0,
                    }
                )
            sections.append(
                {
                    "section": section,
                    "units": units,
                    "total_units": len(units),
                    "completed_units": completed_units,
                }
            )
        return {"book": book, "sections": sections}

    # ── Unit detail ───────────────────────────────────────────────────────
    def unit_detail(self, user, unit_key):
        unit = self._repo.get_unit(unit_key)
        if unit is None:
            raise NotFoundError("Grammar unit not found.")
        exercises = list(self._repo.exercises_for_unit(unit))
        progress = self._repo.exercise_progress_map_for_unit(user, unit)
        unit_progress = self._repo.get_unit_progress(user, unit_key)

        book = unit.section.book
        keys = self._repo.ordered_unit_keys(book)
        prev_key = next_key = None
        try:
            idx = keys.index(unit_key)
            prev_key = keys[idx - 1] if idx > 0 else None
            next_key = keys[idx + 1] if idx < len(keys) - 1 else None
        except ValueError:
            pass
        return {
            "unit": unit,
            "exercises": exercises,
            "progress": progress,
            "unit_progress": unit_progress,
            "prev_key": prev_key,
            "next_key": next_key,
        }

    # ── Grading ───────────────────────────────────────────────────────────
    def submit_exercise(self, user, exercise_key, submissions):
        """Grade a submitted attempt server-side, persist it and roll up the unit.

        ``submissions`` is a list aligned to the exercise's items, each a list of
        typed strings. Returns the score, per-item results (with the canonical
        answers revealed) and the updated progress.
        """
        exercise = self._repo.get_exercise(exercise_key)
        if exercise is None:
            raise NotFoundError("Grammar exercise not found.")
        if not exercise.items:
            raise ValidationError("This exercise has no items to grade.")

        outcome = grading.grade_exercise(exercise.items, submissions)
        last_result = {
            "score": outcome["score"],
            "results": outcome["results"],
            "at": timezone.now().isoformat(),
        }
        exercise_progress = self._repo.record_exercise_attempt(
            user,
            exercise,
            score=outcome["score"],
            completed=outcome["completed"],
            last_result=last_result,
        )
        unit_progress = self._repo.roll_up_unit_progress(user, exercise.unit)
        return {
            "score": outcome["score"],
            "completed": outcome["completed"],
            "results": outcome["results"],
            "exercise_progress": exercise_progress,
            "unit_progress": unit_progress,
        }

    def clear_unit_results(self, user, unit_key):
        """Reset a user's practice results for one unit (highlights are kept).

        Returns the number of exercise-progress rows deleted.
        """
        unit = self._repo.get_unit(unit_key)
        if unit is None:
            raise NotFoundError("Grammar unit not found.")
        return self._repo.clear_unit_results(user, unit_key)

    # ── Highlights ────────────────────────────────────────────────────────
    def set_highlight(self, user, unit_key, *, text, note="", remove=False):
        unit = self._repo.get_unit(unit_key)
        if unit is None:
            raise NotFoundError("Grammar unit not found.")
        return self._repo.set_unit_highlight(user, unit_key, text=text, note=note, remove=remove)

    # ── Import (management command) ───────────────────────────────────────
    def import_book(self, payload):
        """Upsert a whole book from a structured dict; returns import counts.

        The payload is the JSON produced by ``build_grammar_json``. Keys are
        derived here (``book.slug__unit.slug`` etc.) so progress stays stable.
        """
        book = self._repo.upsert_book(
            payload["slug"],
            {
                "title": payload.get("title", ""),
                "level": payload.get("level", ""),
                "description": payload.get("description", ""),
                "source": payload.get("source", payload["slug"]),
                "order": payload.get("order", 0),
            },
        )
        counts = {"sections": 0, "units": 0, "exercises": 0}
        unit_keys = []
        for s_index, section_data in enumerate(payload.get("sections", [])):
            section = self._repo.upsert_section(
                book,
                section_data["slug"],
                {
                    "title": section_data.get("title", ""),
                    "description": section_data.get("description", ""),
                    "order": section_data.get("order", s_index),
                },
            )
            counts["sections"] += 1
            for u_index, unit_data in enumerate(section_data.get("units", [])):
                unit_key = f"{book.slug}__{unit_data['slug']}"
                unit = self._repo.upsert_unit(
                    section,
                    unit_data["slug"],
                    unit_key,
                    {
                        "number": unit_data.get("number", 0),
                        "title": unit_data.get("title", ""),
                        "description": unit_data.get("description", ""),
                        "order": unit_data.get("order", u_index),
                        "explanation": unit_data.get("explanation", []),
                    },
                )
                counts["units"] += 1
                unit_keys.append(unit_key)
                exercise_keys = []
                for e_index, ex_data in enumerate(unit_data.get("exercises", [])):
                    ex_key = f"{unit_key}__{ex_data['slug']}"
                    self._repo.upsert_exercise(
                        unit,
                        ex_data["slug"],
                        ex_key,
                        {
                            "title": ex_data.get("title", ""),
                            "order": ex_data.get("order", e_index),
                            "kind": ex_data.get("kind", "fill_blank"),
                            "prompt": ex_data.get("prompt", ""),
                            "options": ex_data.get("options", []),
                            "items": ex_data.get("items", []),
                        },
                    )
                    counts["exercises"] += 1
                    exercise_keys.append(ex_key)
                self._repo.prune_exercises(unit, exercise_keys)
        self._repo.prune_units(book, unit_keys)
        return {"book": book, "counts": counts}

    def clean_book(self, slug):
        return self._repo.delete_book(slug)

    def clear_all_books(self):
        """Wipe all grammar content before a fresh import. User progress survives
        (keyed on stable unit/exercise keys, not row FKs)."""
        return self._repo.delete_all_books()

    # ── Exercise audit / normalisation ────────────────────────────────────
    def audit_exercises(self, book_slug, *, fix=False):
        """Scan a book's exercises for ones that can't be answered and tidy text.

        Normalises item prompts (leading "1 "/"2." numbering, ragged blank
        markers) and, unless it's a dry run, saves the tidy-ups. Returns
        ``{"total", "normalized", "broken": [{"unit_key", "kind", "prompt",
        "bad": n, "of": n}, ...]}``. Content (answers) is never invented — the
        renderer already makes every answer-bearing item answerable.
        """
        book = self._repo.get_book(book_slug)
        if book is None:
            raise NotFoundError(f"No grammar book with slug '{book_slug}'.")
        total = 0
        normalized = 0
        reclassified = 0
        broken = []
        for exercise in self._repo.exercises_for_book(book):
            total += 1
            items = exercise.items or []
            new_items = []
            changed = False
            for item in items:
                if isinstance(item, dict) and item.get("text"):
                    tidy = _normalize_item_text(item["text"])
                    if tidy != item["text"]:
                        item = {**item, "text": tidy}
                        changed = True
                new_items.append(item)

            # A "choose" with no options anywhere (its alternatives were left
            # inline in the sentence) can't render buttons — treat it as an open
            # answer (fill_blank), which the renderer always makes answerable.
            new_kind = None
            if exercise.kind == "choose":
                has_options = bool(exercise.options) or any(
                    isinstance(it, dict) and it.get("options") for it in new_items
                )
                if not has_options:
                    new_kind = "fill_blank"

            if changed:
                normalized += 1
            if new_kind:
                reclassified += 1
            if (changed or new_kind) and fix:
                self._repo.save_exercise(exercise, items=new_items if changed else None, kind=new_kind)
            exercise.items = new_items
            if new_kind:
                exercise.kind = new_kind
            bad = _exercise_broken_items(exercise)
            if bad:
                broken.append(
                    {
                        "unit_key": exercise.unit.key,
                        "kind": exercise.kind,
                        "prompt": (exercise.prompt or "")[:60],
                        "bad": len(bad),
                        "of": len(items),
                    }
                )
        return {
            "total": total,
            "normalized": normalized,
            "reclassified": reclassified,
            "broken": broken,
        }

    # ── Re-classification ─────────────────────────────────────────────────
    def units_for_book(self, book):
        return self._repo.units_for_book(book)

    def apply_restructure(self, book, plan):
        """Rebuild ``book``'s sections from ``plan`` and move units into them.

        ``plan`` is ``[{"slug", "title", "order", "units": [GrammarUnit, ...]},
        ...]``. Runs in one transaction: sections are upserted, every unit's
        section FK + order is updated, then now-empty sections are removed. Unit
        keys/slugs never change, so no user progress is lost.
        """
        with transaction.atomic():
            seen_slugs = set()
            for order, entry in enumerate(plan):
                slug = slugify(entry.get("slug") or entry.get("title") or "section") or "section"
                base = slug
                i = 2
                while slug in seen_slugs:
                    slug = f"{base}-{i}"
                    i += 1
                seen_slugs.add(slug)
                section = self._repo.upsert_section(
                    book,
                    slug,
                    {"title": (entry.get("title") or "Section").strip(), "order": order, "description": ""},
                )
                for u_order, unit in enumerate(entry.get("units", [])):
                    self._repo.reassign_unit_section(unit, section, u_order)
            self._repo.delete_empty_sections(book)
        return {"sections": len(plan), "units": sum(len(e.get("units", [])) for e in plan)}

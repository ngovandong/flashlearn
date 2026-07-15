"""Persistence for the Grammar feature.

All Django ORM access for grammar books/sections/units/exercises and the two
per-user progress tables lives here so the application service and the DRF
viewset never touch the ORM directly. Progress is keyed on the content's stable
natural ``key`` (``unit_key`` / ``exercise_key``) so re-importing a book never
cascade-deletes a user's progress.
"""

from django.db.models import Prefetch
from django.utils import timezone

from backend.models import (
    GrammarBook,
    GrammarExercise,
    GrammarSection,
    GrammarUnit,
    UserGrammarExerciseProgress,
    UserGrammarUnitProgress,
)


class GrammarRepository:
    # ── Catalog reads ─────────────────────────────────────────────────────
    @staticmethod
    def list_books():
        return GrammarBook.objects.all()

    @staticmethod
    def first_book():
        return GrammarBook.objects.order_by("order", "title").first()

    @staticmethod
    def get_book(slug):
        return GrammarBook.objects.filter(slug=slug).first()

    @staticmethod
    def sections_with_units(book):
        """Every section of ``book`` with its units prefetched, in order."""
        units = GrammarUnit.objects.order_by("order", "number")
        return book.sections.order_by("order").prefetch_related(Prefetch("units", queryset=units))

    @staticmethod
    def units_for_book(book):
        """All units of ``book`` in current section→unit order (for re-classification)."""
        return list(GrammarUnit.objects.filter(section__book=book).order_by("section__order", "order", "number"))

    @staticmethod
    def count_units(book):
        return GrammarUnit.objects.filter(section__book=book).count()

    @staticmethod
    def exercise_counts_for_book(book):
        """``{unit_key: total_exercise_count}`` for every unit in the book."""
        counts = {}
        rows = GrammarExercise.objects.filter(unit__section__book=book).values_list("unit__key", flat=True)
        for unit_key in rows:
            counts[unit_key] = counts.get(unit_key, 0) + 1
        return counts

    @staticmethod
    def get_unit(key):
        return (
            GrammarUnit.objects.filter(key=key)
            .select_related("section__book")
            .prefetch_related(Prefetch("exercises", queryset=GrammarExercise.objects.order_by("order")))
            .first()
        )

    @staticmethod
    def ordered_unit_keys(book):
        """Unit keys in section→unit order (for prev/next navigation)."""
        return list(
            GrammarUnit.objects.filter(section__book=book)
            .order_by("section__order", "order", "number")
            .values_list("key", flat=True)
        )

    @staticmethod
    def get_exercise(key):
        return GrammarExercise.objects.filter(key=key).select_related("unit__section__book").first()

    @staticmethod
    def exercises_for_unit(unit):
        return unit.exercises.order_by("order")

    @staticmethod
    def exercises_for_book(book):
        """Every exercise in ``book`` (with unit/section) for auditing/normalising."""
        return (
            GrammarExercise.objects.filter(unit__section__book=book)
            .select_related("unit__section")
            .order_by("unit__section__order", "unit__order", "order")
        )

    @staticmethod
    def save_exercise(exercise, *, items=None, kind=None):
        fields = ["updated_at"]
        if items is not None:
            exercise.items = items
            fields.append("items")
        if kind is not None:
            exercise.kind = kind
            fields.append("kind")
        exercise.save(update_fields=fields)

    # ── Progress reads ────────────────────────────────────────────────────
    @staticmethod
    def unit_progress_map(user, book):
        """``{unit_key: UserGrammarUnitProgress}`` for the book's units."""
        rows = UserGrammarUnitProgress.objects.filter(user=user, unit_key__startswith=f"{book.slug}__")
        return {row.unit_key: row for row in rows}

    @staticmethod
    def exercise_progress_map_for_book(user, book):
        """``{exercise_key: UserGrammarExerciseProgress}`` across the whole book."""
        rows = UserGrammarExerciseProgress.objects.filter(user=user, exercise_key__startswith=f"{book.slug}__")
        return {row.exercise_key: row for row in rows}

    @staticmethod
    def exercise_progress_map_for_unit(user, unit):
        rows = UserGrammarExerciseProgress.objects.filter(user=user, exercise_key__startswith=f"{unit.key}__")
        return {row.exercise_key: row for row in rows}

    @staticmethod
    def get_unit_progress(user, unit_key):
        return UserGrammarUnitProgress.objects.filter(user=user, unit_key=unit_key).first()

    # ── Progress writes ───────────────────────────────────────────────────
    @staticmethod
    def record_exercise_attempt(user, exercise, *, score, completed, last_result):
        """Upsert an exercise attempt, keeping the best score and completion state."""
        progress, _ = UserGrammarExerciseProgress.objects.get_or_create(user=user, exercise_key=exercise.key)
        progress.attempts += 1
        if score > progress.best_score:
            progress.best_score = score
        if completed and progress.status != UserGrammarExerciseProgress.STATUS_COMPLETED:
            progress.status = UserGrammarExerciseProgress.STATUS_COMPLETED
            progress.completed_at = timezone.now()
        progress.last_result = last_result
        progress.save()
        return progress

    @staticmethod
    def roll_up_unit_progress(user, unit):
        """Recompute a unit's roll-up from its exercises' progress.

        The unit completes once every exercise is completed; ``best_score`` is the
        average of the exercises' best scores. Returns the unit progress row.
        """
        total = unit.exercises.count()
        rows = UserGrammarExerciseProgress.objects.filter(user=user, exercise_key__startswith=f"{unit.key}__")
        rows = list(rows)
        completed_count = sum(1 for r in rows if r.status == UserGrammarExerciseProgress.STATUS_COMPLETED)
        avg = round(sum(r.best_score for r in rows) / total) if total else 0

        progress, _ = UserGrammarUnitProgress.objects.get_or_create(user=user, unit_key=unit.key)
        progress.attempts += 1
        if avg > progress.best_score:
            progress.best_score = avg
        unit_completed = total > 0 and completed_count >= total
        if unit_completed and progress.status != UserGrammarUnitProgress.STATUS_COMPLETED:
            progress.status = UserGrammarUnitProgress.STATUS_COMPLETED
            progress.completed_at = timezone.now()
        progress.last_result = {"score": avg, "at": timezone.now().isoformat()}
        progress.save()
        return progress

    @staticmethod
    def clear_unit_results(user, unit_key):
        """Wipe a user's attempt results for one unit, keeping their highlights.

        Deletes every exercise-progress row under the unit and resets the unit
        roll-up's result fields (status/score/attempts/last_result) in place so the
        saved vocabulary highlights on the same row survive. Returns the number of
        exercise rows removed.
        """
        deleted, _ = UserGrammarExerciseProgress.objects.filter(
            user=user, exercise_key__startswith=f"{unit_key}__"
        ).delete()
        row = UserGrammarUnitProgress.objects.filter(user=user, unit_key=unit_key).first()
        if row is not None:
            row.status = UserGrammarUnitProgress.STATUS_IN_PROGRESS
            row.best_score = 0
            row.attempts = 0
            row.completed_at = None
            row.last_result = {}
            row.save(update_fields=["status", "best_score", "attempts", "completed_at", "last_result", "updated_at"])
        return deleted

    @staticmethod
    def set_unit_highlight(user, unit_key, *, text, note="", remove=False):
        """Add, update or remove a per-user noted word/phrase on a unit."""
        progress, _ = UserGrammarUnitProgress.objects.get_or_create(user=user, unit_key=unit_key)
        highlights = [h for h in (progress.highlights or []) if isinstance(h, dict) and h.get("text")]
        lowered = text.lower()
        existing = next((h for h in highlights if (h.get("text") or "").lower() == lowered), None)
        if remove:
            highlights = [h for h in highlights if (h.get("text") or "").lower() != lowered]
        elif existing is not None:
            existing["note"] = note
        else:
            highlights.append({"text": text, "note": note})
        progress.highlights = highlights
        progress.save(update_fields=["highlights", "updated_at"])
        return highlights

    # ── Importer upserts ──────────────────────────────────────────────────
    @staticmethod
    def upsert_book(slug, defaults):
        book, _ = GrammarBook.objects.update_or_create(slug=slug, defaults=defaults)
        return book

    @staticmethod
    def upsert_section(book, slug, defaults):
        section, _ = GrammarSection.objects.update_or_create(book=book, slug=slug, defaults=defaults)
        return section

    @staticmethod
    def upsert_unit(section, slug, key, defaults):
        unit, _ = GrammarUnit.objects.update_or_create(section=section, slug=slug, defaults={**defaults, "key": key})
        return unit

    @staticmethod
    def upsert_exercise(unit, slug, key, defaults):
        exercise, _ = GrammarExercise.objects.update_or_create(unit=unit, slug=slug, defaults={**defaults, "key": key})
        return exercise

    @staticmethod
    def delete_book(slug):
        """Delete a book (cascading sections/units/exercises). Progress survives
        because it is keyed on the stable unit/exercise key, not a FK."""
        return GrammarBook.objects.filter(slug=slug).delete()

    @staticmethod
    def delete_all_books():
        """Delete every book (cascading its content). Progress survives because it
        is keyed on the stable unit/exercise key, not a FK — a clean re-import
        restores it as long as the keys are unchanged."""
        return GrammarBook.objects.all().delete()

    # ── Re-classification ─────────────────────────────────────────────────
    @staticmethod
    def reassign_unit_section(unit, section, order):
        """Move ``unit`` into ``section`` at ``order``. Unit key/slug (and thus
        user progress) are untouched — only the section FK + order change."""
        unit.section = section
        unit.order = order
        unit.save(update_fields=["section", "order", "updated_at"])

    @staticmethod
    def delete_empty_sections(book):
        """Drop sections of ``book`` that hold no units (left over after a
        re-classification). Only ever removes childless rows, so no unit or
        exercise is ever cascade-deleted."""
        return GrammarSection.objects.filter(book=book, units__isnull=True).delete()

    @staticmethod
    def prune_units(book, keep_keys):
        """Remove units of ``book`` whose key is not in ``keep_keys`` (stale re-import)."""
        return GrammarUnit.objects.filter(section__book=book).exclude(key__in=list(keep_keys)).delete()

    @staticmethod
    def prune_exercises(unit, keep_keys):
        return GrammarExercise.objects.filter(unit=unit).exclude(key__in=list(keep_keys)).delete()

"""Grammar PDF ingestion service.

Turns a grammar ebook (PDF) into the structured book payload the importer
consumes, and inserts it. The pipeline is: extract page text (infrastructure) →
convert consecutive pages into units with the AI coach → group units into
sections → upsert via :class:`GrammarService`.

Extraction from a laid-out workbook is inherently best-effort and the AI step is
non-deterministic, so ingestion is chunked, resumable-ish (dedupes units by
number) and tolerant of a failed chunk. Keys/slugs are normalised here so a
re-run upserts cleanly and never loses user progress.
"""

import logging

from django.utils.text import slugify

logger = logging.getLogger(__name__)


class GrammarIngestService:
    def __init__(self, *, coach, grammar_service, extract_pages):
        self._coach = coach
        self._grammar = grammar_service
        # Callable[[str], list[str]] returning one text string per PDF page.
        self._extract_pages = extract_pages

    def structure_pdf(
        self,
        source,
        *,
        book_meta,
        pages=None,
        pages_per_chunk=4,
        limit=None,
        on_progress=None,
        ocr="auto",
        dpi=200,
        lang="eng",
    ):
        """Extract + AI-structure ``source`` into a book payload (no DB writes).

        ``pages`` is an optional 1-based inclusive ``(start, end)`` range;
        ``limit`` caps the number of units (handy for a trial run). ``ocr``/``dpi``/
        ``lang`` are forwarded to the extractor for scanned PDFs.
        """
        page_texts = self._extract_pages(source, ocr=ocr, dpi=dpi, lang=lang)
        if pages:
            start, end = pages
            page_texts = page_texts[max(start - 1, 0) : end]

        units = []
        seen = set()
        for i in range(0, len(page_texts), pages_per_chunk):
            chunk = "\n\n".join(page_texts[i : i + pages_per_chunk]).strip()
            span = (i + 1, min(i + pages_per_chunk, len(page_texts)))
            if not chunk:
                continue
            try:
                found = self._coach.structure_chunk(chunk)
            except Exception as exc:  # noqa: BLE001 — never abort the whole book on one bad chunk
                logger.warning("Grammar structuring failed for pages %s: %s", span, exc)
                if on_progress:
                    on_progress({"pages": span, "error": str(exc)})
                continue
            for unit in found:
                marker = unit.get("number")
                if not isinstance(marker, int):
                    marker = unit.get("slug") or unit.get("title")
                if marker in seen:
                    continue
                seen.add(marker)
                units.append(unit)
                if on_progress:
                    on_progress({"pages": span, "unit": unit})
                if limit and len(units) >= limit:
                    break
            if limit and len(units) >= limit:
                break

        return self._assemble_payload(book_meta, units)

    # ── Section re-classification ─────────────────────────────────────────
    def restructure_book(self, book_slug, *, dry_run=False):
        """Re-group an already-imported book's units into clean, ordered sections.

        Uses the coach to classify units into a conventional taxonomy, then moves
        each unit into its target section (see ``GrammarService.apply_restructure``).
        Any unit the classifier misses is kept in a trailing "Other" section so
        nothing is ever lost. Returns ``{"book", "plan"}`` where ``plan`` is the
        ordered ``[{"slug", "title", "units": [...]}, ...]`` layout.
        """
        book = self._grammar.get_book(book_slug)
        if book is None:
            raise ValueError(f"No grammar book with slug '{book_slug}'.")
        units = list(self._grammar.units_for_book(book))
        if not units:
            raise ValueError(f"Book '{book_slug}' has no units to restructure.")

        payload = [{"id": i, "number": u.number, "title": u.title} for i, u in enumerate(units)]
        sections = self._coach.classify_sections(payload)

        plan = []
        assigned = set()
        for section in sections:
            title = (section.get("title") or "").strip()
            ids = [
                i
                for i in (section.get("unit_ids") or [])
                if isinstance(i, int) and 0 <= i < len(units) and i not in assigned
            ]
            if not title or not ids:
                continue
            assigned.update(ids)
            plan.append({"slug": _slug(title), "title": title, "units": [units[i] for i in ids]})

        leftover = [units[i] for i in range(len(units)) if i not in assigned]
        if leftover:
            plan.append({"slug": "other", "title": "Other", "units": leftover})

        if not plan:
            raise ValueError("Section classification returned nothing; leaving the book untouched.")

        if not dry_run:
            self._grammar.apply_restructure(book, plan)
        return {"book": book, "plan": plan}

    def import_payload(self, payload):
        # A unit's key is `book.slug__unit.slug`, unique across the whole book, so
        # slugs must be globally unique even across sections. Defensive dedupe here
        # too, so a hand-assembled or `--in` payload can't crash the DB write.
        dedupe_unit_slugs(payload.get("sections", []))
        return self._grammar.import_book(payload)

    # ── Payload assembly ──────────────────────────────────────────────────
    def _assemble_payload(self, book_meta, units):
        """Group AI-produced units into ordered sections with clean slugs/keys."""
        sections = {}
        for unit in sorted(units, key=lambda u: u.get("number") or 0):
            s_slug = _slug(unit.get("section_slug") or unit.get("section_title") or "general")
            if s_slug not in sections:
                sections[s_slug] = {
                    "slug": s_slug,
                    "title": (unit.get("section_title") or "General").strip(),
                    "order": len(sections),
                    "units": [],
                }
            number = unit.get("number") or 0
            sections[s_slug]["units"].append(
                {
                    "number": number,
                    "slug": _slug(unit.get("slug") or unit.get("title") or f"unit-{number}"),
                    "title": (unit.get("title") or f"Unit {number}").strip(),
                    "explanation": _clean_explanation(unit.get("explanation")),
                    "exercises": _clean_exercises(unit.get("exercises")),
                }
            )

        out = list(sections.values())
        dedupe_unit_slugs(out)
        return {**book_meta, "sections": out}


def merge_payloads(payloads):
    """Merge several structured book payloads into one.

    Units are identified by their book unit ``number`` (falling back to slug/title
    when unnumbered); when the same unit appears in more than one payload, the one
    from the LATER payload wins. This lets a targeted re-extraction of a few pages
    override the gaps/failures of an earlier full run. Sections are rebuilt from
    each winning unit's own section, ordered by section then unit number.
    """
    payloads = [p for p in payloads if isinstance(p, dict)]
    if not payloads:
        return {"sections": []}

    meta = {}
    winners = {}  # identity -> {section_slug, section_title, section_order, unit}
    for payload in payloads:
        meta.update({k: v for k, v in payload.items() if k != "sections"})
        for section in payload.get("sections", []):
            for unit in section.get("units", []):
                identity = unit.get("number") or unit.get("slug") or unit.get("title")
                winners[identity] = {
                    "section_slug": section.get("slug") or "general",
                    "section_title": section.get("title") or "General",
                    "section_order": section.get("order", 0),
                    "unit": unit,
                }

    sections = {}
    for record in winners.values():
        s_slug = record["section_slug"]
        section = sections.setdefault(
            s_slug,
            {"slug": s_slug, "title": record["section_title"], "order": record["section_order"], "units": []},
        )
        section["units"].append(record["unit"])

    out = sorted(sections.values(), key=lambda s: s.get("order", 0))
    for section in out:
        section["units"].sort(key=lambda u: u.get("number") or 0)
    return {**meta, "sections": out}


def dedupe_unit_slugs(sections):
    """Ensure unit slugs are unique across the whole book (not just per section).

    Mutates and returns ``sections``. Deterministic given the same input, so a
    re-import maps to the same keys and never loses user progress.
    """
    used = set()
    for section in sections or []:
        for unit in section.get("units", []):
            unit["slug"] = _unique(unit.get("slug") or "unit", used)
    return sections


def _slug(value):
    return slugify(value or "") or "item"


def _unique(base, used):
    slug = base
    i = 2
    while slug in used:
        slug = f"{base}-{i}"
        i += 1
    used.add(slug)
    return slug


def _clean_explanation(blocks):
    out = []
    for block in blocks or []:
        if not isinstance(block, dict):
            continue
        html = (block.get("html") or "").strip()
        if not html:
            continue
        out.append(
            {
                "label": (block.get("label") or "").strip(),
                "html": html,
                "examples": [e.strip() for e in (block.get("examples") or []) if isinstance(e, str) and e.strip()],
            }
        )
    return out


def _clean_exercises(exercises):
    out = []
    used = set()
    for index, ex in enumerate(exercises or []):
        if not isinstance(ex, dict):
            continue
        items = _clean_items(ex.get("items"))
        if not items:
            continue
        kind = ex.get("kind") or "fill_blank"
        slug = _unique(_slug(ex.get("slug") or f"{index + 1}"), used)
        out.append(
            {
                "slug": slug,
                "kind": kind,
                "prompt": (ex.get("prompt") or "").strip(),
                "options": [o for o in (ex.get("options") or []) if isinstance(o, str)],
                "items": items,
            }
        )
    return out


def _clean_items(items):
    out = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        answers = [a for a in (item.get("answers") or []) if isinstance(a, str) and a.strip()]
        if not answers:
            continue
        entry = {"answers": answers}
        if item.get("text"):
            entry["text"] = str(item["text"]).strip()
        if item.get("options"):
            entry["options"] = [o for o in item["options"] if isinstance(o, str)]
        out.append(entry)
    return out

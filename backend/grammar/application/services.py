"""Grammar Coach application service (AI).

Holds the prompts and JSON schema for the Grammar feature's AI "explain" option
so the frontend stays a pure UI layer. Provider-agnostic — depends only on
:class:`AiTextPort`; the concrete provider is injected from the composition root.

The single ``explain`` use case powers both:

* "Explain this rule" from a unit's reference page, and
* "Why is my answer wrong?" after a graded exercise item.
"""

import logging
from typing import Any

from backend.shared.infrastructure.ai import default_ai_provider

logger = logging.getLogger(__name__)

_EXPLAIN_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "answer": {"type": "STRING"},
        "examples": {"type": "ARRAY", "items": {"type": "STRING"}},
        "tip": {"type": "STRING"},
    },
    "required": ["answer"],
}

# ─── Schema for converting raw PDF text into structured units ─────────────────
_ITEM_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "text": {"type": "STRING"},
        "options": {"type": "ARRAY", "items": {"type": "STRING"}},
        "answers": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["answers"],
}

_EXERCISE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "kind": {
            "type": "STRING",
            "enum": ["fill_blank", "choose", "rewrite", "match", "reorder"],
        },
        "prompt": {"type": "STRING"},
        "options": {"type": "ARRAY", "items": {"type": "STRING"}},
        "items": {"type": "ARRAY", "items": _ITEM_SCHEMA},
    },
    "required": ["kind", "items"],
}

_EXPLANATION_BLOCK_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "label": {"type": "STRING"},
        "html": {"type": "STRING"},
        "examples": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["html"],
}

_UNIT_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "number": {"type": "INTEGER"},
        "title": {"type": "STRING"},
        "section_title": {"type": "STRING"},
        "explanation": {"type": "ARRAY", "items": _EXPLANATION_BLOCK_SCHEMA},
        "exercises": {"type": "ARRAY", "items": _EXERCISE_SCHEMA},
    },
    "required": ["number", "title", "section_title"],
}

_STRUCTURE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {"units": {"type": "ARRAY", "items": _UNIT_SCHEMA}},
    "required": ["units"],
}

# ─── Schema for rewriting a unit into a clean, self-contained web lesson ──────
# Only text-solvable kinds are allowed (no images/audio). Reuses ``_ITEM_SCHEMA``
# (text + optional per-item options + answers).
_IMPROVE_EXERCISE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "kind": {"type": "STRING", "enum": ["fill_blank", "choose"]},
        "prompt": {"type": "STRING"},
        "items": {"type": "ARRAY", "items": _ITEM_SCHEMA},
    },
    "required": ["kind", "prompt", "items"],
}

_IMPROVE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "explanation": {"type": "ARRAY", "items": _EXPLANATION_BLOCK_SCHEMA},
        "exercises": {"type": "ARRAY", "items": _IMPROVE_EXERCISE_SCHEMA},
    },
    "required": ["title", "explanation", "exercises"],
}

# ─── Schema for an exercise-only "practice" lesson (no explanation) ───────────
# Reviews grammar already taught elsewhere, so it carries only a title and
# exercises. Unlike ``_IMPROVE_EXERCISE_SCHEMA`` this allows the full set of
# interactive kinds (drag-and-drop ``match``, ``reorder``, ``rewrite``) so
# practice can be varied and fun, not just gap-fills.
_PRACTICE_EXERCISE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "kind": {"type": "STRING", "enum": ["fill_blank", "choose", "match", "reorder", "rewrite"]},
        "prompt": {"type": "STRING"},
        "options": {"type": "ARRAY", "items": {"type": "STRING"}},
        "items": {"type": "ARRAY", "items": _ITEM_SCHEMA},
    },
    "required": ["kind", "prompt", "items"],
}

_PRACTICE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "exercises": {"type": "ARRAY", "items": _PRACTICE_EXERCISE_SCHEMA},
    },
    "required": ["title", "exercises"],
}

# ─── Schema for reconstructing readable content from OCR (answer key is external) ─
# Used to clean a scanned book: the answer key is parsed deterministically, so the
# model only supplies readable prose and the sentence context per item. Exercises
# and items keep their book NUMBER so the caller can align them to the parsed key.
_RECON_ITEM_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "number": {"type": "INTEGER"},
        "text": {"type": "STRING"},
    },
    "required": ["number", "text"],
}

_RECON_EXERCISE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "label": {"type": "STRING"},
        "kind": {"type": "STRING", "enum": ["fill_blank", "choose", "rewrite", "match", "reorder"]},
        "prompt": {"type": "STRING"},
        "options": {"type": "ARRAY", "items": {"type": "STRING"}},
        "items": {"type": "ARRAY", "items": _RECON_ITEM_SCHEMA},
    },
    "required": ["label", "items"],
}

_RECON_UNIT_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "number": {"type": "INTEGER"},
        "title": {"type": "STRING"},
        "explanation": {"type": "ARRAY", "items": _EXPLANATION_BLOCK_SCHEMA},
        "exercises": {"type": "ARRAY", "items": _RECON_EXERCISE_SCHEMA},
    },
    "required": ["number"],
}

_RECON_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {"units": {"type": "ARRAY", "items": _RECON_UNIT_SCHEMA}},
    "required": ["units"],
}

# ─── Schema for aligning a unit's answer key to its reconstructed items ───────
_ALIGN_ANSWER_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "answers": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "label": {"type": "STRING"},
                    "item": {"type": "INTEGER"},
                    "answer": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
                "required": ["label", "item", "answer"],
            },
        }
    },
    "required": ["answers"],
}

_ALIGN_SYSTEM = (
    "You are an expert English-grammar editor. You are given a unit's exercises (each item is a "
    "sentence with a '___' blank and a printed item number) and the book's own ANSWER KEY for that "
    "unit as noisy OCR. The OCR often loses the small item numbers and sometimes an exercise label, "
    "so the answers appear as a clean ordered list with gaps in the numbering. Your job is to attach "
    "the correct answer to each item. Match strictly by the sentence's meaning and by order; never "
    "invent an answer — only use answers that appear in the key. Keep alternative forms the key gives "
    '(e.g. "She\'s / She has") as separate strings. Always answer with a single JSON object matching '
    "the requested schema."
)

# ─── Schema for re-classifying a book's units into thematic sections ──────────
_CLASSIFY_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "sections": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "unit_ids": {"type": "ARRAY", "items": {"type": "INTEGER"}},
                },
                "required": ["title", "unit_ids"],
            },
        }
    },
    "required": ["sections"],
}

# The standard organisation of an English grammar reference (Murphy's "…Grammar
# in Use" family). Offered to the model as the preferred, ordered taxonomy so
# every book in the series ends up with a consistent, predictable structure.
_CANONICAL_SECTIONS = [
    "Present",
    "Past",
    "Present perfect",
    "Passive",
    "Verb forms",
    "Future",
    "Modal verbs",
    "Questions",
    "Reported speech",
    "-ing and to…",
    "Nouns and articles",
    "Determiners and quantifiers",
    "Pronouns and possessives",
    "Adjectives and adverbs",
    "Word order",
    "Conjunctions and clauses",
    "Prepositions",
    "Phrasal verbs",
]

_CLASSIFY_SYSTEM = (
    "You are an expert English-grammar curriculum editor. You organise a grammar book's lessons into a "
    "clean, conventional table of contents. Always answer with a single JSON object matching the schema."
)

_STRUCTURE_SYSTEM = (
    "You are an expert English-grammar editor. You convert raw, noisy text extracted from the pages "
    "of a grammar workbook into clean, structured JSON for a study app. Preserve the book's own units, "
    "titles and exercises; fix obvious extraction artifacts (broken words, column bleed, page numbers). "
    "Only output units whose content is fully present in the given text — never invent units. "
    "Always answer with a single JSON object matching the requested schema."
)

_RECON_SYSTEM = (
    "You are an expert English-grammar editor repairing text from a SCANNED elementary grammar "
    "workbook (Raymond Murphy, 'Essential Grammar in Use'). The input is noisy OCR: broken words, "
    "stray symbols (©, ®, @, |), two-column bleed and misread characters. Your job is to reconstruct "
    "the ORIGINAL, clean, human-readable content — never copy the OCR noise through. Restore proper "
    "words and punctuation (e.g. '|' at the start of a sentence is 'I'; 'Ithas' is 'It has'). "
    "Preserve the book's own unit numbers, exercise numbers and item numbers exactly. "
    "Only output units and exercises that are actually present in the given text — never invent them. "
    "Always answer with a single JSON object matching the requested schema."
)

_IMPROVE_SYSTEM = (
    "You are an expert English-grammar teacher and curriculum designer building clean, self-contained "
    "lessons for an INTERACTIVE WEB study app. The app shows only text — there are NO images, NO audio, "
    "and NO page references. You take one lesson's rough source content (title, explanation, exercises "
    "and answers) that was extracted from a printed coursebook and REWRITE it into a single clear, "
    "well-structured lesson at the given CEFR level. Simplify and improve the explanation, fix any "
    "extraction noise, and make every exercise fully solvable from its own text. Remove exercises that "
    "depend on a picture/audio or other context you cannot reproduce, and add or replace exercises so "
    "the learner has enough correct practice. Everything must be pedagogically correct and faithful to "
    "the grammar point. Always answer with a single JSON object matching the requested schema."
)

_PRACTICE_SYSTEM = (
    "You are an expert English-grammar teacher and game designer building REVIEW practice for an "
    "INTERACTIVE WEB study app. The app shows only text — there are NO images, NO audio and NO page "
    "references — but it supports several fun, interactive exercise formats: gap-fill, multiple-choice, "
    "drag-and-drop MATCHING, word REORDERING (build the sentence), and free REWRITE/transform. You write "
    "one exercise-only practice lesson (no explanation) that CONSOLIDATES grammar the learner has already "
    "been taught, staying at the given CEFR level and covering ONLY the listed grammar points. Make it "
    "varied and engaging by mixing formats. Every exercise must be fully solvable from its own text and "
    "every answer must be grammatically correct. Always answer with a single JSON object matching the "
    "requested schema."
)

_EXPLAIN_SYSTEM = (
    "You are 'Dragon', a warm, encouraging English grammar tutor in a flashcard study app. "
    "You explain English grammar to a beginner/elementary learner in plain, simple language. "
    "Keep the explanation short (2-4 sentences), avoid jargon, and be concrete. "
    "Always answer with a single JSON object matching the requested schema."
)


class GrammarCoachService:
    """AI operations for the Grammar feature (the new AI Assistant option)."""

    def __init__(self, ai: Any = default_ai_provider):
        self._ai = ai

    def explain(
        self,
        *,
        question: str = "",
        unit_title: str = "",
        sentence: str = "",
        given: str = "",
        correct: str = "",
    ) -> dict[str, Any]:
        """Explain a grammar rule, or why a learner's answer was wrong.

        Any subset of the context fields may be provided. Returns
        ``{"answer", "examples", "tip"}``.
        """
        parts = []
        if unit_title:
            parts.append(f'Grammar topic: "{unit_title}".')
        if sentence:
            parts.append(f'Exercise sentence: "{sentence}".')
        if given or correct:
            parts.append(f'The learner answered "{given}" but the correct answer is "{correct}".')
            parts.append("Explain clearly why the correct answer is right and the learner's answer is not.")
        if question:
            parts.append(f'The learner asks: "{question}".')
        if not parts:
            raise ValueError("Nothing to explain — provide a question or context.")
        parts.append(
            "Provide: 'answer' (a short, friendly explanation), 'examples' (1-3 short example "
            "sentences), and 'tip' (one memorable rule of thumb, optional)."
        )
        user_prompt = "\n".join(parts)
        raw = self._ai.generate_json(_EXPLAIN_SYSTEM, user_prompt, _EXPLAIN_SCHEMA)
        raw = raw or {}
        return {
            "answer": _str(raw.get("answer")),
            "examples": [e.strip() for e in (raw.get("examples") or []) if isinstance(e, str) and e.strip()],
            "tip": _str(raw.get("tip")),
        }

    # ── Rewrite a unit into a clean, self-contained web lesson ────────────
    def improve_unit(self, unit: dict[str, Any], *, level: str = "", book_title: str = "") -> dict[str, Any]:
        """Rewrite one unit's explanation + exercises for the web.

        Given a unit dict (``title``, ``explanation``, ``exercises`` with answers),
        returns ``{"title", "explanation", "exercises"}`` where the explanation is
        clear self-contained HTML blocks and every exercise is text-solvable
        (``fill_blank``/``choose``) — image-dependent tasks are dropped/replaced.
        """
        ctx = []
        if book_title:
            ctx.append(f'Book: "{book_title}".')
        if level:
            ctx.append(f"CEFR level: {level}.")
        ctx.append(f'Lesson title: "{(unit.get("title") or "").strip()}".')
        user_prompt = (
            "\n".join(ctx) + "\n\n"
            "Below is this lesson's ROUGH source content (explanation + exercises + answers) extracted "
            "from a printed coursebook. Rewrite it into ONE clean, self-contained web lesson.\n\n"
            "EXPLANATION: 2-5 short blocks. Each block has an optional 'label' (A, B, C…), an 'html' "
            "string (you MAY use <p>, <b>, <ul>, <li>) teaching ONE idea in simple language for this "
            "level, and 1-4 'examples' (full example sentences). Be clear and concise; make NO reference "
            "to pictures, audio, page numbers or other units.\n\n"
            "EXERCISES: 3-5 exercises, each fully solvable from its OWN text. Allowed 'kind':\n"
            "  - 'fill_blank': each item 'text' is a complete sentence with EXACTLY ONE '___' where the "
            "answer goes, with enough context that the answer is unambiguous. 'answers' lists every "
            'acceptable form of that one blank (e.g. ["is"] or ["he\'s", "he is"]).\n'
            "  - 'choose': each item 'text' is a sentence/question with '___' for the gap, 'options' lists "
            "2-4 candidate answers, and 'answers' is the ONE correct option copied EXACTLY from 'options'.\n"
            "Give each exercise a short 'prompt' (the instruction) and 5-8 items. DROP any task that needs "
            "a picture, audio or missing context; if the source is thin, ADD your own correct items so "
            "there is enough practice. Every answer MUST be grammatically correct.\n\n"
            f"SOURCE CONTENT:\n{self._source_digest(unit)}"
        )
        raw = self._ai.generate_json(_IMPROVE_SYSTEM, user_prompt, _IMPROVE_SCHEMA)
        return raw or {}

    # ── Generate an exercise-only review/practice lesson ──────────────────
    def generate_practice(
        self,
        *,
        topics: list[str],
        book_title: str = "",
        level: str = "",
        scope_title: str = "",
        whole_book: bool = False,
        num_exercises: int = 4,
        variant: int = 1,
        total_variants: int = 1,
        sample_digest: str = "",
    ) -> dict[str, Any]:
        """Write one exercise-only practice lesson reviewing ``topics``.

        Returns ``{"title", "exercises"}`` (no explanation) where every exercise is
        text-solvable (``fill_blank``/``choose``). ``topics`` bounds the grammar so
        the lesson only reviews what the learner has already met; ``variant`` /
        ``total_variants`` nudge the model to make each set in a group distinct.
        """
        topics = [t.strip() for t in (topics or []) if isinstance(t, str) and t.strip()]
        scope = (scope_title or "").strip() or ("the whole book" if whole_book else "this section")
        covers = "ALL the grammar covered in the book" if whole_book else f'the grammar taught in the section "{scope}"'
        ctx = []
        if book_title:
            ctx.append(f'Book: "{book_title}".')
        if level:
            ctx.append(f"CEFR level: {level}.")
        user_prompt = (
            "\n".join(ctx) + "\n\n"
            f"Create ONE exercise-only PRACTICE lesson (NO explanation) that reviews {covers}.\n"
            f"This is practice set {variant} of {total_variants}: make its sentences and vocabulary DISTINCT "
            "from the other sets — do NOT reuse the same example sentences.\n\n"
            "Review ONLY these grammar points; do NOT introduce grammar beyond this list:\n"
            + "\n".join(f"  - {t}" for t in topics)
            + "\n\n"
            f"Produce a short 'title' (e.g. \"{scope} — Practice {variant}\") and {num_exercises} exercises. "
            "Mix the grammar points across the exercises so several points are practised together, and use a "
            "VARIETY of exercise kinds to keep it fun and interactive: use at least THREE different kinds in "
            "the lesson, and whenever the grammar suits it PREFER the interactive 'match' (drag-and-drop) and "
            "'reorder' kinds over plain gap-fills. Each exercise is fully solvable from its OWN text. Give "
            "each exercise a short 'prompt' (the instruction). The exact 'kind' options and their item shapes:\n"
            "  - 'fill_blank': each item 'text' is a complete sentence with EXACTLY ONE '___' where the "
            "answer goes, with enough context that the answer is unambiguous. 'answers' lists every "
            'acceptable form of that one blank (e.g. ["is"] or ["he\'s", "he is"]). 6-8 items.\n'
            "  - 'choose': each item 'text' is a sentence/question with '___' for the gap, 'options' lists "
            "2-4 candidate answers, and 'answers' is the ONE correct option copied EXACTLY from 'options'. 6-8 items.\n"
            "  - 'match' (DRAG-AND-DROP): the learner drags a card onto each row. Each item 'text' is the LEFT "
            "cue and 'answers' is ITS single correct RIGHT side; also list EVERY right side in the exercise-level "
            "'options'. Use 4-6 items with DISTINCT right sides. Perfect for question↔short answer, verb↔past "
            "form, word↔opposite, phrase↔meaning.\n"
            "  - 'reorder' (BUILD THE SENTENCE): the app shuffles the words and the learner taps them back into "
            "order. Put the FULL correct sentence as the single string in 'answers' and leave 'text' empty. "
            "5-7 items, each sentence 4-9 words, natural and correct in ONE clear order.\n"
            "  - 'rewrite': item 'text' is a short instruction to transform a sentence (e.g. \"Make negative: "
            'She is happy." or "Ask a question: He works here."); \'answers\' is the full correct sentence '
            "(list acceptable variants). 5-7 items.\n"
            "Every answer MUST be grammatically correct.\n"
            + (
                f"\nFor style/level reference, here are example items from the source lessons:\n{sample_digest}"
                if sample_digest
                else ""
            )
        )
        raw = self._ai.generate_json(_PRACTICE_SYSTEM, user_prompt, _PRACTICE_SCHEMA)
        return raw or {}

    @staticmethod
    def _source_digest(unit: dict[str, Any]) -> str:
        """A compact readable dump of a unit's explanation + exercises (with answers)."""
        lines: list[str] = []
        for block in unit.get("explanation") or []:
            if not isinstance(block, dict):
                continue
            label = (block.get("label") or "").strip()
            html = (block.get("html") or "").strip()
            if html:
                lines.append(f"[{label}] {html}" if label else html)
            for example in block.get("examples") or []:
                if isinstance(example, str) and example.strip():
                    lines.append(f"  e.g. {example.strip()}")
        for ex in unit.get("exercises") or []:
            if not isinstance(ex, dict):
                continue
            lines.append("")
            lines.append(f"Exercise [{ex.get('kind', '')}] {(ex.get('prompt') or '').strip()}".rstrip())
            for item in ex.get("items") or []:
                if not isinstance(item, dict):
                    continue
                text = (item.get("text") or "").strip()
                flat = []
                for ans in item.get("answers") or []:
                    if isinstance(ans, list | tuple):
                        flat.append("/".join(str(a) for a in ans))
                    else:
                        flat.append(str(ans))
                suffix = f"  [answer: {'; '.join(flat)}]" if flat else ""
                lines.append(f"  - {text}{suffix}")
        return "\n".join(lines).strip()

    # ── PDF ingestion ─────────────────────────────────────────────────────
    def structure_chunk(self, text: str) -> list[dict[str, Any]]:
        """Convert raw extracted text from consecutive PDF pages into units.

        Returns a list of unit dicts matching the import schema. The exercise
        answer key is generated by the model (the book prints its key in a
        separate appendix, so it is not present on the unit page); each item's
        ``answers`` has one entry per blank/slot.
        """
        text = (text or "").strip()
        if not text:
            return []
        user_prompt = (
            "Below is raw text extracted from consecutive pages of an elementary English grammar "
            "workbook. Convert every COMPLETE unit you find into structured JSON.\n\n"
            "For each unit provide: 'number' (the unit number), 'title', the 'section_title' of the "
            "part it belongs to, an 'explanation' (the reference blocks, each with an optional 'label' "
            "like A/B/C, an 'html' "
            "string that may use <b> for emphasis, and 'examples'), and 'exercises'.\n"
            "Each exercise has a 'kind' (fill_blank | choose | rewrite | match | reorder), a 'prompt' "
            "(the instruction), optional 'options' (shared choices for choose/match), and 'items'.\n"
            "Each item has 'text' (use '___' to mark a blank) and 'answers' — a list with ONE entry per "
            "blank in order (the correct answer you determine). For 'choose', 'answers' is the correct "
            "option; for 'rewrite'/'reorder', 'answers' is the full correct sentence; for 'match', give "
            "each pair as an item whose 'text' is the left side and 'answers' the matching right side, "
            "with all right sides also listed in the exercise 'options'.\n"
            "Skip tables of contents, appendices and answer-key pages. Never invent a unit that is not in "
            "the text.\n\n"
            f"RAW TEXT:\n{text}"
        )
        raw = self._ai.generate_json(_STRUCTURE_SYSTEM, user_prompt, _STRUCTURE_SCHEMA)
        units = (raw or {}).get("units") or []
        return [u for u in units if isinstance(u, dict)]

    def reconstruct_chunk(self, text: str) -> list[dict[str, Any]]:
        """Reconstruct readable units from noisy OCR of consecutive pages.

        Unlike :meth:`structure_chunk`, this NEVER produces answers — the answer
        key is parsed deterministically elsewhere and stays authoritative. The
        model only cleans the prose and rebuilds each item's sentence context,
        keeping the book's unit/exercise/item NUMBERS so the caller can align the
        text to the parsed key. Returns a list of unit dicts (see
        ``_RECON_UNIT_SCHEMA``).
        """
        text = (text or "").strip()
        if not text:
            return []
        user_prompt = (
            "Below is raw OCR text from consecutive pages of the scanned workbook. Reconstruct every "
            "COMPLETE unit you can read into clean JSON.\n\n"
            "For each unit give: 'number' (the printed unit number ONLY — an integer), 'title' (JUST the "
            "grammar point, e.g. 'I have done (present perfect 1)' — never add page numbers, notes or "
            "commentary), 'explanation' (the left-hand reference blocks — each an optional 'label' like "
            "A/B/C, an 'html' string that may use <b> for emphasis, and short 'examples'), and "
            "'exercises' (the right-hand practice).\n"
            "IMPORTANT: in this book every unit's explanation page FACES an exercises page, so a real unit "
            "almost always has exercises. You MUST extract them. Each exercise MUST carry its full printed "
            "'label' exactly as shown in the text — e.g. '15.2' (unit 15, exercise 2). This label is how "
            "the exercise is matched, so copy the two numbers faithfully even if the surrounding text is "
            "noisy. Also give a 'kind' (fill_blank | choose | rewrite | match | reorder), the 'prompt' "
            "instruction, and 'options' (shared choices for choose/match only).\n"
            "Each item keeps its 'number' (the printed item number, e.g. 1, 2, 3 …, INCLUDING the worked "
            "example) and a 'text': the full readable sentence with '___' marking exactly where the "
            "missing word(s) go. Do NOT include answers — only the sentence with the blank. If you cannot "
            "read an item's sentence, omit that item.\n"
            "Fix OCR damage so the result reads naturally. Skip the table of contents, appendices, index "
            "and answer-key pages entirely (do NOT emit units for them), and never invent a unit, exercise "
            "or item that is not in the text.\n\n"
            f"RAW OCR TEXT:\n{text}"
        )
        raw = self._ai.generate_json(_RECON_SYSTEM, user_prompt, _RECON_SCHEMA)
        units = (raw or {}).get("units") or []
        return [u for u in units if isinstance(u, dict)]

    def align_answers(self, exercises: list[dict[str, Any]], key_text: str) -> dict[str, dict[int, list[str]]]:
        """Attach the unit's answer-key answers to its reconstructed items.

        ``exercises`` is ``[{"label": "15.2", "items": [{"number": 2, "text": "…___…"}, …]}]``
        (the LLM-reconstructed sentences); ``key_text`` is the raw OCR answer key
        for that same unit. The model matches each answer to an item by meaning and
        order — this handles OCR that dropped the key's item numbers / labels.

        Returns ``{label: {item_number: [answer, alt, …]}}``. Answers are grounded
        in ``key_text`` (the prompt forbids inventing), so correctness rests on the
        printed key, not the model.
        """
        exercises = [e for e in (exercises or []) if e.get("label")]
        key_text = (key_text or "").strip()
        if not exercises or not key_text:
            return {}
        lines = []
        for ex in exercises:
            its = ex.get("items") or []
            if its:
                lines.append(f"Exercise {ex.get('label')}:")
                for it in its:
                    lines.append(f"  item {it.get('number')}: {it.get('text')}")
            else:
                # Picture/table exercise: no readable sentence, but the key still
                # lists its answers in order — tell the model the exercise exists.
                lines.append(
                    f"Exercise {ex.get('label')}: (no item sentences available — take this "
                    "exercise's answers from the key in order)"
                )
        user_prompt = (
            "Here are the exercises of one grammar unit — each item is numbered and its sentence has a "
            "'___' where the answer goes:\n\n"
            + "\n".join(lines)
            + "\n\nHere is the book's ANSWER KEY for the SAME unit, as noisy OCR (item numbers may be "
            "missing or scrambled; an exercise label may be absent — the answers are otherwise a clean "
            "ordered list):\n\n"
            + key_text
            + "\n\nOutput one entry per answer, with the exercise 'label', the 'item' number, and "
            "'answer'. Cover EVERY answer printed in the key — do not stop early and do not skip any.\n"
            "NUMBERING: the 'item' number MUST be the number of the sentence above that the answer "
            "completes — match each key answer to its sentence by MEANING, not by the key's own numbers "
            "(the key's small numbers are scrambled/missing and MUST be ignored). For an exercise with no "
            "sentences shown (picture/table), number its answers 2, 3, 4 … in key order (item 1 is the "
            "worked example). NEVER put a number inside the 'answer' text.\n"
            "ANSWER TEXT: copy the wording from the key — do not paraphrase or add words like 'I'. Each "
            "string in 'answer' must be a COMPLETE, acceptable answer for the blank. When the key uses a "
            "'/' shorthand for two forms that share the rest of the answer (e.g. \"She's/She has gone\" or "
            '"They\'re/They are cold"), EXPAND it into the full alternatives — "She\'s gone" and "She '
            'has gone" — each as its own complete string; never leave a bare fragment like "She\'s" or '
            '"are cold". If an item has several blanks, give ONE string per accepted full answer using '
            "'...' between the blanks. An exercise may have MORE items in the key than sentences shown — "
            "include them all. Do NOT invent answers; omit an item only if the key truly has none."
        )
        raw = self._ai.generate_json(_ALIGN_SYSTEM, user_prompt, _ALIGN_ANSWER_SCHEMA)
        out: dict[str, dict[int, list[str]]] = {}
        for a in (raw or {}).get("answers") or []:
            if not isinstance(a, dict):
                continue
            label = str(a.get("label") or "").strip()
            item = a.get("item")
            answers = [s.strip() for s in (a.get("answer") or []) if isinstance(s, str) and s.strip()]
            if label and isinstance(item, int) and answers:
                out.setdefault(label, {})[item] = answers
        return out

    # ── Section re-classification ─────────────────────────────────────────
    def classify_sections(self, units: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Group a book's units into an ordered, conventional set of sections.

        ``units`` is ``[{"id": int, "title": str, "number": int?}, ...]`` where
        ``id`` is a stable index. Returns ``[{"title", "unit_ids": [id, ...]},
        ...]`` in learning order — a full re-classification independent of the
        (often noisy) sections captured during PDF extraction.
        """
        clean = [u for u in units if isinstance(u, dict) and (u.get("title") or "").strip()]
        if not clean:
            return []
        lines = []
        for u in clean:
            num = u.get("number")
            suffix = f" (book unit {num})" if isinstance(num, int) and num else ""
            lines.append(f"{u['id']}. {(u.get('title') or '').strip()}{suffix}")
        preferred = "; ".join(_CANONICAL_SECTIONS)
        user_prompt = (
            "Here is the full list of lessons in an English grammar book, one per line as `id. title`.\n"
            "Group EVERY lesson into a clean, ordered set of thematic sections for a study app's table of "
            "contents, following the standard organisation of an English grammar reference.\n"
            f"Prefer these section names, in roughly this order, using only the ones that apply: {preferred}.\n"
            "You may add a section only if a group of lessons clearly fits none of the above. Keep sections "
            "in a logical learning order and lessons in a sensible order within each section.\n"
            "Rules: every lesson id must appear in EXACTLY ONE section; do not invent, drop or renumber "
            "lessons; return each section's 'title' and its ordered 'unit_ids'.\n\n"
            "LESSONS:\n" + "\n".join(lines)
        )
        raw = self._ai.generate_json(_CLASSIFY_SYSTEM, user_prompt, _CLASSIFY_SCHEMA)
        sections = (raw or {}).get("sections") or []
        return [s for s in sections if isinstance(s, dict)]


def _str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""

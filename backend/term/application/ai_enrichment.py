"""Application service that turns a bare term into Oxford-dictionary-style data.

It is provider-agnostic: it depends only on :class:`AiTextPort`. The concrete
provider (Gemini, ...) is injected from the composition root.
"""

import logging
from typing import Any

from backend.shared.infrastructure.ai import default_ai_provider

logger = logging.getLogger(__name__)

# Gemini/OpenAPI structured-output schema (uppercase OpenAPI types).
ENRICHMENT_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "word_type": {"type": "STRING"},
        "pronunciation": {"type": "STRING"},
        "definition": {"type": "STRING"},
        "synonyms": {"type": "ARRAY", "items": {"type": "STRING"}},
        "antonyms": {"type": "ARRAY", "items": {"type": "STRING"}},
        "examples": {"type": "ARRAY", "items": {"type": "STRING"}},
        "word_forms": {"type": "ARRAY", "items": {"type": "STRING"}},
        "word_family": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": [
        "word_type",
        "pronunciation",
        "definition",
        "synonyms",
        "antonyms",
        "examples",
        "word_forms",
        "word_family",
    ],
}

_RULES = (
    "1. If the term is a single English word or a common lexical item, fill every field: "
    "word_type (e.g. Noun, Verb, Adjective, Adverb, Phrasal verb), pronunciation as IPA "
    "wrapped in slashes (e.g. /ɔɪl/), an English definition, synonyms, antonyms and examples.\n"
    "2. If the term is a phrase, idiom, full sentence or an abbreviation/acronym "
    "(e.g. 'GOAT', 'prompt someone to do something'), focus on a clear English definition "
    "(for an acronym, expand it, e.g. GOAT -> 'Greatest Of All Time') and helpful examples. "
    "Leave word_type, pronunciation, synonyms and antonyms empty ('' or []) when they do not apply.\n"
    "3. Provide 5 to 8 natural example sentences. In EVERY example, wrap the main term "
    "(or its inflected form) in <b>...</b> HTML tags so it can be highlighted. Examples may be "
    "plain text otherwise; do not use any other HTML tags.\n"
    "4. Never translate or change the user's native-language meaning; only produce English-side data.\n"
    "5. Keep synonyms and antonyms to single words or short phrases (max 8 each).\n"
    "6. word_forms: list the grammatical inflections of the SAME word, each as 'label: form' "
    "(e.g. for 'run' -> ['present participle: running', 'past tense: ran', 'past participle: run']; "
    "for a noun -> ['plural: ...']). Leave [] when there are no meaningful inflections.\n"
    "7. word_family: list related words in OTHER parts of speech (derivations), each as "
    "'part of speech: word' (e.g. for 'specify' -> ['noun: specification', 'adverb: specifically']). "
    "Leave [] when none apply. Keep each list to at most 8 entries."
)

_SYSTEM_PROMPT = (
    "You are a bilingual lexicographer that enriches flashcard terms with data "
    "similar to the Oxford Learner's Dictionary. Always answer with a single JSON "
    "object matching the requested schema. Follow these rules:\n" + _RULES
)

_BATCH_SYSTEM_PROMPT = (
    "You are a bilingual lexicographer that enriches flashcard terms with data "
    "similar to the Oxford Learner's Dictionary. You are given a list of terms and must "
    "return a JSON object with a 'terms' array containing exactly one entry per input term. "
    "Echo each input term verbatim in the entry's 'term' field. Follow these rules for each term:\n" + _RULES
)

# Per-entry schema shared by single and batch enrichment.
_ENTRY_PROPERTIES: dict[str, Any] = {
    "word_type": {"type": "STRING"},
    "pronunciation": {"type": "STRING"},
    "definition": {"type": "STRING"},
    "synonyms": {"type": "ARRAY", "items": {"type": "STRING"}},
    "antonyms": {"type": "ARRAY", "items": {"type": "STRING"}},
    "examples": {"type": "ARRAY", "items": {"type": "STRING"}},
    "word_forms": {"type": "ARRAY", "items": {"type": "STRING"}},
    "word_family": {"type": "ARRAY", "items": {"type": "STRING"}},
}

BATCH_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "terms": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {"term": {"type": "STRING"}, **_ENTRY_PROPERTIES},
                "required": ["term", *_ENTRY_PROPERTIES.keys()],
            },
        }
    },
    "required": ["terms"],
}


def _as_str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _as_str_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = _as_str(item)
        if text:
            out.append(text)
        if len(out) >= limit:
            break
    return out


class TermEnrichmentService:
    def __init__(self, ai: Any = default_ai_provider):
        self._ai = ai

    def enrich(self, name: str, meaning: str | None = None) -> dict[str, Any]:
        """Return generated term fields. Raises on provider/validation failure."""
        name = (name or "").strip()
        if not name:
            raise ValueError("name is required to enrich a term")

        user_prompt = f"Term: {name}"
        if meaning and meaning.strip():
            user_prompt += f"\nNative-language meaning (do not change): {meaning.strip()}"

        raw = self._ai.generate_json(_SYSTEM_PROMPT, user_prompt, ENRICHMENT_SCHEMA)
        return self._normalize(raw)

    def enrich_many(self, names: list[str]) -> dict[str, dict[str, Any]]:
        """Enrich several term names in a single AI request.

        Returns a mapping of lowercased name -> normalized fields. Names the
        provider omits are simply absent from the result (caller decides what to
        do). Grouping by name (callers should pass unique names) keeps token
        usage low when the same word appears in many decks.
        """
        cleaned = [n.strip() for n in names if n and n.strip()]
        if not cleaned:
            return {}

        user_prompt = "Enrich each of the following terms:\n" + "\n".join(f"- {n}" for n in cleaned)
        raw = self._ai.generate_json(_BATCH_SYSTEM_PROMPT, user_prompt, BATCH_SCHEMA)

        out: dict[str, dict[str, Any]] = {}
        for item in raw.get("terms", []) or []:
            if not isinstance(item, dict):
                continue
            term = _as_str(item.get("term"))
            if term:
                out[term.lower()] = self._normalize(item)
        return out

    @staticmethod
    def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
        return {
            "word_type": _as_str(raw.get("word_type"))[:50],
            "pronunciation": _as_str(raw.get("pronunciation"))[:255],
            "definition": _as_str(raw.get("definition")),
            "synonyms": _as_str_list(raw.get("synonyms"), 8),
            "antonyms": _as_str_list(raw.get("antonyms"), 8),
            "examples": _as_str_list(raw.get("examples"), 8),
            "word_forms": _as_str_list(raw.get("word_forms"), 8),
            "word_family": _as_str_list(raw.get("word_family"), 8),
        }

import logging
import os

from django.utils import timezone

from ..models import Term

logger = logging.getLogger(__name__)

# Unique term names sent per AI request. One request enriches X distinct names,
# and each result is applied to every term sharing that name, so the effective
# terms-per-request is usually much higher than X. ~20 keeps the JSON response
# comfortably within gemini-flash limits while cutting request count ~20x.
AI_ENRICH_BATCH = int(os.getenv("AI_ENRICH_BATCH", "20"))

# Distinct names processed per cron tick (every 2 minutes) to respect free-tier
# rate limits. With AI_ENRICH_BATCH=20 this is 2 requests per tick.
CRON_MAX_NAMES = int(os.getenv("AI_CRON_MAX_NAMES", "40"))

_FIELD_KEYS = (
    "word_type",
    "pronunciation",
    "definition",
    "synonyms",
    "antonyms",
    "examples",
    "word_forms",
    "word_family",
)


def _chunks(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def _apply_to_name(name: str, data: dict, deck_id: str | None = None, force: bool = False) -> int:
    """Write enriched fields to every term that shares this name.

    By default only not-yet-filled terms are updated; ``force`` re-fills terms
    even when ``ai_filled`` is already set. When ``deck_id`` is given the update
    is scoped to that deck only.
    """
    update_fields = {
        key: data.get(key, "" if key in ("word_type", "pronunciation", "definition") else []) for key in _FIELD_KEYS
    }
    qs = Term.objects.filter(name=name)
    if not force:
        qs = qs.filter(ai_filled=False)
    if deck_id:
        qs = qs.filter(deck_id=deck_id)
    return qs.update(
        ai_filled=True,
        updated_at=timezone.now(),
        **update_fields,
    )


def fill_terms_with_ai(
    max_names: int | None = CRON_MAX_NAMES,
    batch_names: int = AI_ENRICH_BATCH,
    on_progress=None,
    abort_after_failures: int | None = None,
    provider: str | None = None,
    model: str | None = None,
    deck: str | None = None,
    force: bool = False,
) -> dict:
    """Backfill Oxford-style data for terms that have not been AI-filled yet.

    Terms are deduplicated by ``name`` (a word shared across many decks/users —
    including via deck cloning — is enriched once and applied to all copies), and
    names are sent to the provider in batches of ``batch_names`` per request.

    ``max_names`` caps how many distinct names are processed in this run
    (``None`` processes all remaining names). Idempotent via the ``ai_filled``
    flag, so it can be re-run safely.

    ``on_progress`` is an optional callable invoked after each batch with a dict
    of cumulative stats, so callers (e.g. the management command) can stream
    progress instead of waiting for the whole run to finish.

    ``abort_after_failures`` stops the run early after that many consecutive
    failed batches (e.g. when every AI provider is exhausted), so we don't churn
    through the whole backlog producing nothing. ``None`` disables the guard.

    ``provider`` overrides the default provider chain with a specific provider
    (or comma-separated chain), e.g. ``"openrouter"`` to bypass a rate-limited
    Gemini. ``model`` overrides the model for a single chosen provider.

    ``deck`` scopes the run to a single deck (its UUID): only that deck's terms
    are selected and updated.

    ``force`` re-fills every matching term even if it was already ``ai_filled``
    (a "pure" rebuild), instead of skipping previously filled terms.
    """
    if provider:
        from backend.shared.infrastructure.ai import build_named_provider
        from backend.term.application.ai_enrichment import TermEnrichmentService

        term_enrichment_service = TermEnrichmentService(ai=build_named_provider(provider, model=model))
    else:
        from ..services import term_enrichment_service

    base_qs = Term.objects.all() if force else Term.objects.filter(ai_filled=False)
    if deck:
        base_qs = base_qs.filter(deck_id=deck)
    names_qs = base_qs.order_by("name").values_list("name", flat=True).distinct()
    names = list(names_qs if max_names is None else names_qs[:max_names])
    if not names:
        return {"names": 0, "filled": 0, "failed_names": 0, "requests": 0, "aborted": False}

    total_chunks = (len(names) + batch_names - 1) // batch_names
    filled = failed_names = requests = 0
    consecutive_failures = 0
    aborted = False
    for chunk in _chunks(names, batch_names):
        requests += 1
        responded = 0
        chunk_failed = False
        try:
            results = term_enrichment_service.enrich_many(chunk)
        except Exception as exc:
            logger.exception("AI batch enrichment failed for %d names", len(chunk))
            failed_names += len(chunk)
            chunk_failed = True
            results = {}
            chunk_error = str(exc)
        else:
            chunk_error = None
            for name in chunk:
                data = results.get(name.strip().lower())
                if not data:
                    failed_names += 1
                    continue
                responded += 1
                try:
                    filled += _apply_to_name(name, data, deck_id=deck, force=force)
                except Exception:
                    logger.exception("Failed to persist AI data for name %r", name)
                    failed_names += 1
                    responded -= 1

        logger.info(
            "AI backfill batch %d/%d: ai_responded=%d/%d filled_terms=%d failed_names=%d",
            requests,
            total_chunks,
            responded,
            len(chunk),
            filled,
            failed_names,
        )
        if on_progress is not None:
            on_progress(
                {
                    "batch": requests,
                    "total_batches": total_chunks,
                    "chunk_size": len(chunk),
                    "responded": responded,
                    "filled": filled,
                    "failed_names": failed_names,
                    "chunk_failed": chunk_failed,
                    "error": chunk_error,
                }
            )

        # A batch counts as a real failure only when nothing was enriched.
        consecutive_failures = consecutive_failures + 1 if responded == 0 else 0
        if abort_after_failures and consecutive_failures >= abort_after_failures:
            logger.error(
                "Aborting AI backfill after %d consecutive failed batches "
                "(likely all providers exhausted); re-run later.",
                consecutive_failures,
            )
            aborted = True
            break

    logger.info(
        "AI term backfill: names=%d filled_terms=%d failed_names=%d requests=%d aborted=%s",
        len(names),
        filled,
        failed_names,
        requests,
        aborted,
    )
    return {
        "names": len(names),
        "filled": filled,
        "failed_names": failed_names,
        "requests": requests,
        "aborted": aborted,
    }

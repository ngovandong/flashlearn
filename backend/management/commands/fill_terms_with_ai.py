from django.core.management.base import BaseCommand, CommandError

from backend.models import Deck, Term
from backend.tasks.ai import AI_ENRICH_BATCH, fill_terms_with_ai


class Command(BaseCommand):
    help = (
        "Backfill AI term data (definition, pronunciation, examples, ...) for every "
        "term not yet marked ai_filled. Terms sharing the same name are enriched once "
        "and applied to all copies, and names are sent to the AI provider in batches."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=AI_ENRICH_BATCH,
            help=f"Distinct names per AI request (default {AI_ENRICH_BATCH}).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Max distinct names to process (default: all remaining names).",
        )
        parser.add_argument(
            "--abort-after-failures",
            type=int,
            default=5,
            help=(
                "Stop early after this many consecutive failed batches (e.g. all AI "
                "providers exhausted). 0 disables the guard. Default 5."
            ),
        )
        parser.add_argument(
            "--provider",
            default=None,
            help=(
                "Use a specific AI provider (e.g. 'openrouter', 'gemini') or a "
                "comma-separated failover chain, bypassing the default env chain. "
                "Handy when the default primary (Gemini) is rate-limited."
            ),
        )
        parser.add_argument(
            "--model",
            default=None,
            help="Override the model for the chosen --provider (single provider only).",
        )
        parser.add_argument(
            "--deck",
            default=None,
            help="Only enrich terms belonging to this deck UUID (default: all decks).",
        )
        parser.add_argument(
            "--pure",
            action="store_true",
            help="Re-fill ALL terms with AI, even ones already marked ai_filled.",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        limit = options["limit"]
        abort_after = options["abort_after_failures"] or None
        provider = options["provider"]
        model = options["model"]
        deck = options["deck"]
        pure = options["pure"]

        pending_qs = Term.objects.all() if pure else Term.objects.filter(ai_filled=False)
        if deck:
            if not Deck.objects.filter(id=deck).exists():
                raise CommandError(f"Deck {deck} does not exist.")
            pending_qs = pending_qs.filter(deck_id=deck)

        pending_names = pending_qs.values_list("name", flat=True).distinct().count()
        pending_terms = pending_qs.count()
        if pending_names == 0:
            scope = f" in deck {deck}" if deck else ""
            done = "exist" if pure else "are already ai_filled"
            self.stdout.write(self.style.SUCCESS(f"Nothing to do: no terms{scope} {done}."))
            return

        deck_note = f" in deck {deck}" if deck else ""
        pure_note = " (pure re-fill of all terms)" if pure else ""
        provider_note = f" via provider={provider}" + (f" model={model}" if model else "") if provider else ""
        self.stdout.write(
            f"Backfilling {pending_terms} term(s) across {pending_names} unique name(s)"
            f"{deck_note} in batches of {batch_size}{provider_note}{pure_note}..."
        )

        def on_progress(p):
            line = (
                f"[{p['batch']}/{p['total_batches']}] "
                f"ai_responded={p['responded']}/{p['chunk_size']} "
                f"filled_terms={p['filled']} failed_names={p['failed_names']}"
            )
            if p["chunk_failed"]:
                self.stdout.write(self.style.WARNING(f"{line}  (batch failed: {p['error']})"))
            else:
                self.stdout.write(self.style.SUCCESS(line))
            self.stdout.flush()

        result = fill_terms_with_ai(
            max_names=limit,
            batch_names=batch_size,
            on_progress=on_progress,
            abort_after_failures=abort_after,
            provider=provider,
            model=model,
            deck=deck,
            force=pure,
        )

        if result.get("aborted"):
            self.stdout.write(
                self.style.ERROR(
                    "Aborted: every AI provider failed for several batches in a row. "
                    "Check that at least one provider is usable (Gemini quota not "
                    "exhausted, DeepSeek has balance), then re-run."
                )
            )

        msg = (
            f"Done. processed_names={result['names']} filled_terms={result['filled']} "
            f"failed_names={result['failed_names']} ai_requests={result['requests']}"
        )
        if result["failed_names"]:
            self.stdout.write(self.style.WARNING(msg))
            self.stdout.write(
                self.style.WARNING("Some names were not returned by the provider; re-run the command to retry them.")
            )
        else:
            self.stdout.write(self.style.SUCCESS(msg))

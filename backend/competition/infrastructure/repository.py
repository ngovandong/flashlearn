"""ORM access for competition scores. The only place competition rows are read
or written."""

from backend.models import CompetitionScore, Term


class CompetitionRepository:
    @staticmethod
    def pool_terms(deck_id, limit=60):
        """A random sample of full-field terms to build any game's questions
        client-side. Read-only cross-aggregate access, like the Revise
        repository's candidate gathering."""
        return list(Term.objects.filter(deck_id=deck_id).order_by("?")[:limit])

    @staticmethod
    def get_best(user_id, deck_id, game_key):
        return CompetitionScore.objects.filter(user_id=user_id, deck_id=deck_id, game_key=game_key).first()

    @staticmethod
    def upsert_best(user_id, deck_id, game_key, score):
        """Keep only the player's best score per (deck, game). Returns
        ``(row, improved)``."""
        row, created = CompetitionScore.objects.get_or_create(
            user_id=user_id,
            deck_id=deck_id,
            game_key=game_key,
            defaults={"score": score},
        )
        improved = created
        if not created and score > row.score:
            row.score = score
            row.save(update_fields=["score", "updated_at"])
            improved = True
        return row, improved

    @staticmethod
    def top_scores(deck_id, game_key, limit=10):
        return list(
            CompetitionScore.objects.filter(deck_id=deck_id, game_key=game_key)
            .select_related("user")
            .order_by("-score", "updated_at")[:limit]
        )

    @staticmethod
    def rank_for_score(deck_id, game_key, score):
        """1-based rank of ``score`` on the board (how many players scored
        strictly higher, plus one)."""
        higher = CompetitionScore.objects.filter(deck_id=deck_id, game_key=game_key, score__gt=score).count()
        return higher + 1

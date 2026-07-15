"""Competition mini-games use cases: serve a term pool for building games
client-side, and persist / rank per-deck leaderboard scores.

Kept intentionally separate from spaced-repetition: competition scores never
touch ``UserLearningProgress``.
"""

from typing import Any

from backend.competition.infrastructure.repository import CompetitionRepository
from backend.shared.application.exceptions import ValidationError

GAME_KEYS = frozenset({"race", "blaster", "tug", "tower", "picture", "sentence", "buzzer"})


class CompetitionService:
    POOL_SIZE = 60
    LEADERBOARD_SIZE = 10
    MAX_SCORE = 1_000_000

    def __init__(
        self,
        repo: type[CompetitionRepository] | CompetitionRepository = CompetitionRepository,
        deck_service: Any = None,
    ):
        self._repo = repo
        self._deck_service = deck_service

    def _validate_game_key(self, game_key):
        if game_key not in GAME_KEYS:
            raise ValidationError("Unknown game.")

    def _validate_score(self, score):
        try:
            value = int(score)
        except (TypeError, ValueError):
            raise ValidationError("Score must be a number.")
        if value < 0 or value > self.MAX_SCORE:
            raise ValidationError("Score out of range.")
        return value

    def get_pool(self, user, deck_id):
        deck = self._deck_service.assert_can_view(user, deck_id)
        terms = self._repo.pool_terms(deck_id, self.POOL_SIZE)
        return {"deck_name": deck.name, "terms": terms}

    def submit_score(self, user, deck_id, game_key, score):
        self._deck_service.assert_can_view(user, deck_id)
        self._validate_game_key(game_key)
        value = self._validate_score(score)
        row, improved = self._repo.upsert_best(user.id, deck_id, game_key, value)
        rank = self._repo.rank_for_score(deck_id, game_key, row.score)
        return {"best_score": row.score, "improved": improved, "rank": rank}

    def get_leaderboard(self, user, deck_id, game_key):
        self._deck_service.assert_can_view(user, deck_id)
        self._validate_game_key(game_key)
        entries = self._repo.top_scores(deck_id, game_key, self.LEADERBOARD_SIZE)
        my_best = self._repo.get_best(user.id, deck_id, game_key)
        my_score = my_best.score if my_best else None
        my_rank = self._repo.rank_for_score(deck_id, game_key, my_best.score) if my_best else None
        return {"entries": entries, "my_score": my_score, "my_rank": my_rank}

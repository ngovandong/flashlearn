from django.db import models

from base.models import DateTimeUUIDModel

from .deck import Deck
from .user import User


class CompetitionScore(DateTimeUUIDModel):
    """A player's best score for one competition mini-game on one deck.

    Competition is pure fun: these scores drive the per-deck leaderboards and
    the "beat your best" ghost, and are deliberately kept separate from
    spaced-repetition ``UserLearningProgress``.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="competition_scores")
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name="competition_scores")
    game_key = models.CharField(max_length=16, db_index=True)
    score = models.IntegerField(default=0)

    class Meta:
        ordering = ("-score", "-updated_at")
        constraints = [
            models.UniqueConstraint(
                fields=["user", "deck", "game_key"],
                name="uniq_competition_user_deck_game",
            ),
        ]

"""Term access rules — domain policy."""

from backend.constants import FULL_ROLE_CLASS
from backend.deck.domain.access import DeckAccessPolicy


class TermAccessPolicy:
    @staticmethod
    def can_edit(term, user) -> bool:
        deck = term.deck
        if deck.owner == user:
            return True
        return DeckAccessPolicy.get_user_role(deck, user) == FULL_ROLE_CLASS.EDIT

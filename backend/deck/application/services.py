from typing import Any

from backend.constants import FULL_ROLE_CLASS
from backend.deck.domain.access import DeckAccessPolicy
from backend.deck.infrastructure.repository import DeckRepository
from backend.models import User
from backend.shared.application.exceptions import ConflictError, PermissionDeniedError, ValidationError


class DeckService:
    def __init__(
        self,
        deck_repo: type[DeckRepository] | DeckRepository = DeckRepository,
        user_context: Any = None,
        learning_context: Any = None,
    ):
        self._deck_repo = deck_repo
        self._user_context = user_context
        self._learning_context = learning_context

    def get_retrieve_queryset(self, user):
        return self._deck_repo.get_retrieve_queryset(user)

    def get_search_queryset(self, user, search_query):
        return self._deck_repo.get_search_queryset(user, search_query)

    def get_my_own_decks(self, user):
        return self._deck_repo.get_my_own_decks(user)

    def get_my_others_deck(self, user):
        return self._deck_repo.get_my_others_deck(user)

    def get_my_decks(self, user):
        return self._deck_repo.get_my_decks(user)

    def get_public_decks(self, user):
        return self._deck_repo.get_public_decks(user)

    def get_latest_decks(self, user):
        return self._deck_repo.get_latest_decks(user)

    def get_deck_by_id(self, deck_id):
        return self._deck_repo.get_by_id(deck_id)

    def assert_can_view(self, user, deck_id):
        """Guard collection-level term reads: only members (or anyone, for a
        public deck) may list/search a deck's terms."""
        deck = self._deck_repo.get_by_id(deck_id)
        if deck is None or not DeckAccessPolicy.can_view(deck, user):
            raise PermissionDeniedError("You don't have permission to view this deck.")
        return deck

    def touch_on_retrieve(self, deck):
        self._deck_repo.touch_updated_at(deck)

    def destroy_deck(self, deck):
        self._deck_repo.clear_default_deck_for_users(deck)
        deck.delete()

    def add_user_to_deck(self, deck, request_user, email, user_role):
        user_to_add = User.objects.get_by_email(email)
        if not user_to_add:
            raise ValidationError("user not found")
        if user_to_add in deck.users.all() or user_to_add == request_user:
            raise ConflictError("User is already in this deck.")
        self._deck_repo.add_user(deck, user_to_add, user_role)
        return deck

    def remove_user_from_deck(self, deck, request_user, email):
        user = User.objects.get_by_email(email)
        if not user:
            raise ValidationError("user not found")
        if user not in deck.users.all() and user != request_user:
            raise ConflictError("User is not in this deck.")
        self._deck_repo.remove_user(deck, user)

    def join_deck(self, deck, user):
        if not deck.is_public:
            raise PermissionDeniedError("You don't have permission to do this.")
        if self._deck_repo.user_in_deck(deck, user):
            raise ConflictError("You are already in this deck.")
        self._deck_repo.add_user(deck, user, FULL_ROLE_CLASS.VIEW_ONLY)

    def leave_deck(self, deck, user):
        if not self._deck_repo.user_in_deck(deck, user):
            raise ConflictError("You are not in this deck.")
        self._deck_repo.leave_deck(deck, user)

    def clone_deck(self, old_deck, user):
        return self._deck_repo.clone_deck(old_deck, user)

    def set_default_deck(self, user, deck, cache=None):
        self._deck_repo.set_default_deck(user, deck)
        if self._user_context:
            self._user_context.clear_cache(user.id, cache)

    def clear_learning_process(self, deck_id, user):
        if self._learning_context is None:
            raise RuntimeError("learning_context is not configured")
        self._learning_context.clear_learning_progress(deck_id, user)

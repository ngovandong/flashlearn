from backend.constants import FULL_ROLE_CLASS
from backend.deck.infrastructure.repository import DeckRepository
from backend.models import User
from backend.shared.application.exceptions import ConflictError, PermissionDeniedError, ValidationError
from backend.user.infrastructure.repository import UserRepository


class DeckService:
    @staticmethod
    def get_retrieve_queryset(user):
        return DeckRepository.get_retrieve_queryset(user)

    @staticmethod
    def get_search_queryset(user, search_query):
        return DeckRepository.get_search_queryset(user, search_query)

    @staticmethod
    def get_my_own_decks(user):
        return DeckRepository.get_my_own_decks(user)

    @staticmethod
    def get_my_others_deck(user):
        return DeckRepository.get_my_others_deck(user)

    @staticmethod
    def get_my_decks(user):
        return DeckRepository.get_my_decks(user)

    @staticmethod
    def get_public_decks(user):
        return DeckRepository.get_public_decks(user)

    @staticmethod
    def get_latest_decks(user):
        return DeckRepository.get_latest_decks(user)

    @staticmethod
    def touch_on_retrieve(deck):
        DeckRepository.touch_updated_at(deck)

    @staticmethod
    def destroy_deck(deck):
        DeckRepository.clear_default_deck_for_users(deck)
        deck.delete()

    @staticmethod
    def add_user_to_deck(deck, request_user, email, user_role):
        user_to_add = User.objects.get_by_email(email)
        if not user_to_add:
            raise ValidationError("user not found")
        if user_to_add in deck.users.all() or user_to_add == request_user:
            raise ConflictError("user is already in deck")
        DeckRepository.add_user(deck, user_to_add, user_role)
        return deck

    @staticmethod
    def remove_user_from_deck(deck, request_user, email):
        user = User.objects.get_by_email(email)
        if not user:
            raise ValidationError("user not found")
        if user not in deck.users.all() and user != request_user:
            raise ConflictError("user isn't in deck")
        DeckRepository.remove_user(deck, user)

    @staticmethod
    def join_deck(deck, user):
        if not deck.is_public:
            raise PermissionDeniedError("You have not permission")
        if DeckRepository.user_in_deck(deck, user):
            raise ConflictError("user is already in deck")
        DeckRepository.add_user(deck, user, FULL_ROLE_CLASS.VIEW_ONLY)

    @staticmethod
    def leave_deck(deck, user):
        if not DeckRepository.user_in_deck(deck, user):
            raise ConflictError("user is not in deck")
        DeckRepository.leave_deck(deck, user)

    @staticmethod
    def clone_deck(old_deck, user):
        return DeckRepository.clone_deck(old_deck, user)

    @staticmethod
    def set_default_deck(user, deck, cache=None):
        from backend.shared.infrastructure.cache import default_cache

        DeckRepository.set_default_deck(user, deck)
        UserRepository.clear_cache(user.id, cache or default_cache)

    @staticmethod
    def clear_learning_process(deck_id, user):
        from backend.learning.application.services import LearningService

        LearningService.clear_learning_progress(deck_id, user)

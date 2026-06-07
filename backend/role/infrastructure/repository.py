from backend.models import Deck, UserDeckRole


class RoleRepository:
    @staticmethod
    def get_by_id(role_id):
        return UserDeckRole.objects.filter(pk=role_id).first()

    @staticmethod
    def get_deck(deck_id):
        return Deck.objects.filter(id=deck_id).first()

    @staticmethod
    def user_in_deck(deck, user):
        return user in deck.users.all() or user == deck.owner

    @staticmethod
    def add_user_to_deck(deck, user, role):
        deck_role = UserDeckRole(deck=deck, user=user, role=role)
        deck_role.save()
        return deck_role

    @staticmethod
    def save(role):
        role.save()

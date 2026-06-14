"""Deck access rules — domain policy, independent of Django ORM."""

from backend.constants import FULL_ROLE_CLASS


class DeckAccessPolicy:
    @staticmethod
    def get_user_role(deck, user) -> str | None:
        if user == deck.owner or getattr(user, "is_superuser", False):
            return FULL_ROLE_CLASS.OWNER
        for role in deck.user_roles.all():
            if role.user == user:
                return role.role
        return None

    @classmethod
    def can_edit(cls, deck, user) -> bool:
        if getattr(user, "is_superuser", False):
            return True
        user_role = cls.get_user_role(deck, user)
        if user_role is None:
            return False
        return user_role in (FULL_ROLE_CLASS.EDIT, FULL_ROLE_CLASS.OWNER)

    @classmethod
    def is_member(cls, deck, user) -> bool:
        return cls.get_user_role(deck, user) is not None

    @classmethod
    def can_view(cls, deck, user) -> bool:
        return deck.is_public or cls.get_user_role(deck, user) is not None or getattr(user, "is_superuser", False)

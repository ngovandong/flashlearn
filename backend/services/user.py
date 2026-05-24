from django.db import transaction

from core.cache import cache

from ..constants import DEFAULT_USER_SETTINGS
from ..models import Deck, User, UserSetting
from ..tasks import setup_new_user as setup_new_user_task
from ..utils.dispatch import dispatch

DEFAULT_DECK_NAME_TEMPLATE = "{name}'s Default deck"


class UserService:
    @classmethod
    @transaction.atomic
    def user_get_or_create_validated_email_user(cls, email: str, **extra_data) -> tuple[User, bool]:
        user = User.objects.get_by_email(email)
        if user:
            return user, False
        extra_data["is_validated_email"] = True
        user = User.objects.create_user(email, None, **extra_data)
        dispatch(setup_new_user_task, user.id, send_welcome_email=True)
        return user, True

    @classmethod
    def seed_settings_for_user(cls, user: User) -> None:
        UserSetting.objects.get_or_create(user=user, key="reminder_email", defaults={"value": user.email})
        for key, default_value in DEFAULT_USER_SETTINGS.items():
            UserSetting.objects.get_or_create(user=user, key=key, defaults={"value": default_value})

    @classmethod
    @transaction.atomic
    def create_default_deck_for_user(cls, user: User) -> Deck | None:
        if user.default_deck_id:
            return user.default_deck

        display_name = (user.name or user.email.split("@")[0]).strip()
        deck = Deck.objects.create(
            name=DEFAULT_DECK_NAME_TEMPLATE.format(name=display_name),
            description="",
            is_public=False,
            field="",
            owner=user,
        )
        user.default_deck = deck
        user.save(update_fields=["default_deck"])
        cls.clear_cache(user.id)
        return deck

    @classmethod
    def provision_new_user(cls, user: User) -> None:
        cls.seed_settings_for_user(user)
        cls.create_default_deck_for_user(user)

    @classmethod
    def active_user(cls, user_id):
        user = User.objects.get(pk=user_id)
        user.is_validated_email = True
        user.save()
        cls.clear_cache(user_id)

    @classmethod
    def clear_cache(cls, user_id):
        key = f"user_{user_id}"
        cache.delete(key)

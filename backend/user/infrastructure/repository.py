import logging

from django.db import transaction

from backend.constants import DEFAULT_USER_SETTINGS
from backend.models import Deck, User, UserSetting

logger = logging.getLogger(__name__)


class UserRepository:
    @staticmethod
    def get_by_id(user_id):
        return User.objects.filter(pk=user_id).first()

    @staticmethod
    def get_by_email(email):
        return User.objects.get_by_email(email)

    @staticmethod
    def get_cached(user_id, cache):
        key = f"user_{user_id}"
        user = cache.get(key)
        if user is None:
            user = User.objects.filter(pk=user_id).first()
            if user:
                cache.set(key, user, timeout=300)
        return user

    @staticmethod
    def clear_cache(user_id, cache):
        cache.delete(f"user_{user_id}")

    @staticmethod
    def create_user(email, password=None, **extra_data):
        return User.objects.create_user(email, password, **extra_data)

    @staticmethod
    def save(user, update_fields=None):
        if update_fields:
            user.save(update_fields=update_fields)
        else:
            user.save()

    @staticmethod
    def seed_settings(user):
        UserSetting.objects.get_or_create(user=user, key="reminder_email", defaults={"value": user.email})
        for key, default_value in DEFAULT_USER_SETTINGS.items():
            UserSetting.objects.get_or_create(user=user, key=key, defaults={"value": default_value})

    @staticmethod
    @transaction.atomic
    def create_default_deck(user, deck_name_template):
        if user.default_deck_id:
            return user.default_deck

        display_name = (user.name or user.email.split("@")[0]).strip()
        deck = Deck.objects.create(
            name=deck_name_template.format(name=display_name),
            description="",
            is_public=False,
            field="",
            owner=user,
        )
        user.default_deck = deck
        user.save(update_fields=["default_deck"])
        return deck

    @staticmethod
    def clone_starter_decks(user, deck_specs):
        """Clone preset starter decks for a new user.

        ``deck_specs`` is an iterable of ``(source_deck_id, name_template)``; the
        template may use ``{name}`` for the user's display name. Missing source
        decks are skipped so user provisioning never fails because of them.
        """
        from backend.deck.infrastructure.repository import DeckRepository

        display_name = (user.name or user.email.split("@")[0]).strip()
        cloned = []
        for source_id, name_template in deck_specs:
            source = Deck.objects.filter(pk=source_id).first()
            if not source:
                logger.warning("Starter deck %s not found; skipping clone for %s", source_id, user.email)
                continue
            cloned.append(DeckRepository.clone_deck_as(source, user, name_template.format(name=display_name)))
        return cloned

    @staticmethod
    def get_settings(user):
        return UserSetting.objects.filter(user=user)

    @staticmethod
    def update_settings(user, settings_dict):
        for key, value in settings_dict.items():
            UserSetting.objects.update_or_create(user=user, key=key, defaults={"value": value})
        return UserSetting.objects.filter(user=user)

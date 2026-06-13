from typing import Any

from django.db import transaction

from backend.shared.application.exceptions import ValidationError
from backend.shared.infrastructure.cache import default_cache
from backend.tasks.user import setup_new_user as setup_new_user_task
from backend.user.infrastructure.repository import UserRepository
from backend.utils.dispatch import dispatch

DEFAULT_DECK_NAME_TEMPLATE = "{name}'s Default deck"


class UserService:
    def __init__(self, user_repo: type[UserRepository] | UserRepository = UserRepository, cache: Any = default_cache):
        self._user_repo = user_repo
        self._cache = cache

    @transaction.atomic
    def user_get_or_create_validated_email_user(self, email: str, **extra_data):
        user = self._user_repo.get_by_email(email)
        if user:
            return user, False
        extra_data["is_validated_email"] = True
        user = self._user_repo.create_user(email, None, **extra_data)
        dispatch(setup_new_user_task, user.id, send_welcome_email=True)
        return user, True

    def seed_settings_for_user(self, user):
        self._user_repo.seed_settings(user)

    @transaction.atomic
    def create_default_deck_for_user(self, user):
        return self._user_repo.create_default_deck(user, DEFAULT_DECK_NAME_TEMPLATE)

    def provision_new_user(self, user):
        self.seed_settings_for_user(user)
        self.create_default_deck_for_user(user)

    def active_user(self, user_id):
        user = self._user_repo.get_by_id(user_id)
        if user:
            user.is_validated_email = True
            self._user_repo.save(user)
            self.clear_cache(user_id)

    def clear_cache(self, user_id, cache=None):
        self._user_repo.clear_cache(user_id, cache or self._cache)

    def get_settings(self, user):
        return {s.key: s.value for s in self._user_repo.get_settings(user)}

    def update_settings(self, user, settings_dict):
        return {s.key: s.value for s in self._user_repo.update_settings(user, settings_dict)}

    def change_password(self, user, old_password, new_password):
        if not user.check_password(old_password):
            raise ValidationError("Wrong password.")
        user.set_password(new_password)
        self._user_repo.save(user)


class AuthService:
    def __init__(self, oauth):
        self._oauth = oauth

    def get_verify_email_token(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        return str(refresh)

    def get_token(self, user):
        from typing import Any, cast

        from django.contrib.auth.models import update_last_login
        from rest_framework_simplejwt.settings import api_settings
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        token = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(cast(Any, None), user)
        return token

    def get_invite_token(self, deck_id, role):
        from backend.token import JWTToken

        payload = {"deck_id": deck_id, "role": role}
        return JWTToken.generate_token(payload)

    def google_validate_id_token(self, id_token: str):
        return self._oauth.validate_id_token(id_token)

    def google_get_access_token(self, code: str, redirect_uri: str) -> str:
        return self._oauth.get_access_token(code, redirect_uri)

    def google_get_user_info(self, access_token: str):
        return self._oauth.get_user_info(access_token)

    def google_profile_from_user_data(self, user_data):
        return {
            "email": user_data["email"],
            "first_name": user_data.get("given_name", ""),
            "last_name": user_data.get("family_name", ""),
            "name": user_data.get("name", ""),
            "image_url": user_data.get("picture", ""),
        }

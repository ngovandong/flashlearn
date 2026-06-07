from django.db import transaction

from backend.shared.application.exceptions import ValidationError
from backend.shared.infrastructure.cache import default_cache
from backend.shared.infrastructure.google_oauth import default_oauth_client
from backend.tasks.user import setup_new_user as setup_new_user_task
from backend.user.infrastructure.repository import UserRepository
from backend.utils.dispatch import dispatch

DEFAULT_DECK_NAME_TEMPLATE = "{name}'s Default deck"


class UserService:
    @classmethod
    @transaction.atomic
    def user_get_or_create_validated_email_user(cls, email: str, **extra_data):
        user = UserRepository.get_by_email(email)
        if user:
            return user, False
        extra_data["is_validated_email"] = True
        user = UserRepository.create_user(email, None, **extra_data)
        dispatch(setup_new_user_task, user.id, send_welcome_email=True)
        return user, True

    @classmethod
    def seed_settings_for_user(cls, user):
        UserRepository.seed_settings(user)

    @classmethod
    @transaction.atomic
    def create_default_deck_for_user(cls, user):
        return UserRepository.create_default_deck(user, DEFAULT_DECK_NAME_TEMPLATE)

    @classmethod
    def provision_new_user(cls, user):
        cls.seed_settings_for_user(user)
        cls.create_default_deck_for_user(user)

    @classmethod
    def active_user(cls, user_id):
        user = UserRepository.get_by_id(user_id)
        if user:
            user.is_validated_email = True
            UserRepository.save(user)
            cls.clear_cache(user_id)

    @classmethod
    def clear_cache(cls, user_id, cache=None):
        UserRepository.clear_cache(user_id, cache or default_cache)

    @classmethod
    def get_settings(cls, user):
        return {s.key: s.value for s in UserRepository.get_settings(user)}

    @classmethod
    def update_settings(cls, user, settings_dict):
        return {s.key: s.value for s in UserRepository.update_settings(user, settings_dict)}

    @classmethod
    def change_password(cls, user, old_password, new_password):
        if not user.check_password(old_password):
            raise ValidationError("Wrong password.")
        user.set_password(new_password)
        UserRepository.save(user)


class AuthService:
    _oauth = default_oauth_client

    @classmethod
    def get_verify_email_token(cls, user):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        return str(refresh)

    @classmethod
    def get_token(cls, user):
        from django.contrib.auth.models import update_last_login
        from rest_framework_simplejwt.settings import api_settings
        from rest_framework_simplejwt.tokens import RefreshToken

        from backend.serializers import UserSerializer

        token = {}
        refresh = RefreshToken.for_user(user)
        serializer = UserSerializer(instance=user)
        refresh["user"] = serializer.data
        token["refresh"] = str(refresh)
        token["access"] = str(refresh.access_token)
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)
        return token

    @classmethod
    def get_invite_token(cls, deck_id, role):
        from backend.token import JWTToken

        payload = {"deck_id": deck_id, "role": role}
        return JWTToken.generate_token(payload)

    @classmethod
    def google_validate_id_token(cls, id_token: str):
        return cls._oauth.validate_id_token(id_token)

    @classmethod
    def google_get_access_token(cls, code: str, redirect_uri: str) -> str:
        return cls._oauth.get_access_token(code, redirect_uri)

    @classmethod
    def google_get_user_info(cls, access_token: str):
        return cls._oauth.get_user_info(access_token)

    @classmethod
    def google_profile_from_user_data(cls, user_data):
        return {
            "email": user_data["email"],
            "first_name": user_data.get("given_name", ""),
            "last_name": user_data.get("family_name", ""),
            "name": user_data.get("name", ""),
            "image_url": user_data.get("picture", ""),
        }

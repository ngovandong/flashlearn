from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
from django.utils.translation import gettext_lazy as _
from django.core.cache import cache as redis_cache
from django.conf import settings


class SKIP_REDIS:
    @staticmethod
    def get(key):
        return None

    @staticmethod
    def set(key, value, live_time=None):
        pass

    @staticmethod
    def delete(key):
        pass


cache = None

if settings.SKIP_REDIS == "1":
    cache = SKIP_REDIS()
else:
    cache = redis_cache


class CustomTokenAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        """
        Attempts to find and return a user using the given validated token.
        """
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError:
            raise InvalidToken(
                _("Token contained no recognizable user identification"))

        try:
            key = f"user_{user_id}"
            user = cache.get(key)

            if user is None:
                user = self.user_model.objects.get(
                    **{api_settings.USER_ID_FIELD: user_id})
                cache.set(key, user, timeout=None)
        except self.user_model.DoesNotExist:
            raise AuthenticationFailed(
                _("User not found"), code="user_not_found")

        if not user.is_active:
            raise AuthenticationFailed(
                _("User is inactive"), code="user_inactive")

        return user
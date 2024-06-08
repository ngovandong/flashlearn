from typing import Tuple

from django.db import transaction

from ..models import User
from core.cache import cache


class UserService:
    @classmethod
    @transaction.atomic
    def user_get_or_create_validated_email_user(cls, email: str, **extra_data) -> Tuple[User, bool]:
        user = User.objects.get_by_email(email)
        if user:
            return user, False
        extra_data['is_validated_email'] = True
        return User.objects.create_user(email, None, **extra_data), True

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
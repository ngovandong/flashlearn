from typing import Any, cast

from django.contrib.auth.models import update_last_login
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings

from ..models import User
from .user import UserSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = cast(User, self.user)
        if not user.is_validated_email:
            raise serializers.ValidationError({"errors": "Please activate your account from the link we emailed you."})
        data = cast(dict[str, Any], data)
        data["user"] = UserSerializer(user).data
        return data


class ActiveAccountSerializer(TokenRefreshSerializer):
    user_id = None

    @classmethod
    def get_token(cls, user):
        return cls.token_class.for_user(user)

    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = self.token_class(cast(Any, data["refresh"]))
        user_id = refresh.payload["user_id"]
        self.user_id = user_id
        user = User.objects.filter(id=user_id).first()
        if user is None:
            raise ValidationError("User not found.")
        refresh = self.get_token(user)

        data = cast(dict[str, Any], data)
        data["refresh"] = str(refresh)
        data["access"] = str(refresh.access_token)
        data["user"] = UserSerializer(user).data

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(cast(Any, None), user)

        return data

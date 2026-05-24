from django.contrib.auth.models import update_last_login
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings

from ..models import User
from .user import UserSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        serializer = UserSerializer(instance=user)
        token["user"] = serializer.data
        # ...
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_validated_email:
            raise serializers.ValidationError({"errors": "Please activate your email account!"})
        return data


class ActiveAccountSerializer(TokenRefreshSerializer):
    user_id = None

    @classmethod
    def get_token(cls, user):
        token = cls.token_class.for_user(user)
        # Add custom claims
        serializer = UserSerializer(instance=user)
        token["user"] = serializer.data
        # ...
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = self.token_class(data["refresh"])
        user_id = refresh.payload["user_id"]
        self.user_id = user_id
        user = User.objects.filter(id=user_id).first()
        if user is None:
            raise ValidationError("User not found")
        refresh = self.get_token(user)

        data["refresh"] = str(refresh)
        data["access"] = str(refresh.access_token)

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)

        return data

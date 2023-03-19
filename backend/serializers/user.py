from rest_framework import serializers
from rest_framework_simplejwt.serializers import PasswordField

from ..models import User


# from ..services import MailService


class UserSerializer(serializers.ModelSerializer):
    password = PasswordField()

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'password', 'first_name', 'last_name', 'image_url']

    # def validate_email(self, value):
    #     if not MailService.validate_email(value):
    #         raise serializers.ValidationError("Email address isn't valid")
    #     return value

    def create(self, validated_data):
        ModelClass = self.Meta.model
        return ModelClass.objects.create_user(**validated_data)


class GoogleUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'image_url', 'first_name', 'last_name']


class SetPasswordSerializer(serializers.Serializer):
    old_password = PasswordField()
    new_password = PasswordField()

    def validate(self, attrs):
        old_password = attrs['old_password']
        new_password = attrs['new_password']
        if old_password == new_password:
            raise serializers.ValidationError(
                {"new_password": "new password must be difference!"}
            )
        return attrs

    def save(self, **kwargs):
        user = self.context['user']
        old_password = self.validated_data['old_password']
        new_password = self.validated_data['new_password']
        if not user.check_password(old_password):
            raise serializers.ValidationError(
                {"old_password": "old password wrong!"}
            )
        user.set_password(new_password)
        user.save()
        return user


class GoogleCallbackSerializer(serializers.Serializer):
    code = serializers.CharField(required=False)
    error = serializers.CharField(required=False)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

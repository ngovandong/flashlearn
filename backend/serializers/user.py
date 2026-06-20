from rest_framework import serializers

from ..models import User


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    is_superuser = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "password",
            "first_name",
            "last_name",
            "image_url",
            "default_deck",
            "is_superuser",
        ]

    def create(self, validated_data):
        ModelClass = self.Meta.model
        return ModelClass.objects.create_user(**validated_data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if ret.get("default_deck"):
            ret["default_deck"] = str(ret["default_deck"])
        return ret


class GoogleUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()

    class Meta:
        model = User
        fields = ["id", "email", "name", "image_url", "first_name", "last_name"]


class SetPasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField()

    def validate(self, attrs):
        old_password = attrs["old_password"]
        new_password = attrs["new_password"]
        if old_password == new_password:
            raise serializers.ValidationError({"new_password": "New password must be different from your current one."})
        return attrs


class GoogleCallbackSerializer(serializers.Serializer):
    code = serializers.CharField(required=False)
    error = serializers.CharField(required=False)
    state = serializers.CharField(required=False)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

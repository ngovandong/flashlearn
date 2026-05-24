from rest_framework import serializers

from ..models import UserDeckRole


class UserDeckRoleSerializer(serializers.ModelSerializer):
    email = serializers.ReadOnlyField(source="user.email")

    class Meta:
        model = UserDeckRole
        fields = ("id", "email", "role", "streaks")


class UpdateRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserDeckRole
        fields = ("role",)


class AddUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email")

    class Meta:
        model = UserDeckRole
        fields = ("email", "role")


class RemoveUserSerializer(serializers.Serializer):
    email = serializers.EmailField()


class InviteSerializer(serializers.Serializer):
    USER_ROLE_CHOICES = (
        ("E", "Edit"),
        ("V", "ViewOnly"),
    )
    role = serializers.ChoiceField(choices=USER_ROLE_CHOICES)

    def validate_role(self, value):
        """
        Ensure that the role is valid.
        """
        choices = dict(self.USER_ROLE_CHOICES)
        if value not in choices:
            raise serializers.ValidationError(f"Invalid role '{value}'. Must be one of: {', '.join(choices.keys())}")
        return value

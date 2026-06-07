from rest_framework import serializers

from ..constants import USER_ROLE_CHOICES
from ..models import UserDeckRole


class UserDeckRoleSerializer(serializers.ModelSerializer):
    email = serializers.ReadOnlyField(source="user.email")

    class Meta:
        model = UserDeckRole
        fields = ("id", "email", "role")


class UpdateRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserDeckRole
        fields = ("role",)


class AddUserSerializer(serializers.ModelSerializer):
    """Read-only representation of a deck membership (used in DeckDetailSerializer.user_roles)."""

    email = serializers.EmailField(source="user.email")

    class Meta:
        model = UserDeckRole
        fields = ("email", "role")


class AddUserToDeckSerializer(serializers.Serializer):
    """Input serializer for the add_user_to_deck action.

    Kept separate from AddUserSerializer (which has source="user.email" for output)
    so validated_data exposes a flat "email" key.
    """

    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=USER_ROLE_CHOICES)


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

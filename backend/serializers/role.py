from rest_framework import serializers
from ..models import UserDeckRole


# from . import DeckSerializer, UserSerializer


class UserDeckRoleSerializer(serializers.ModelSerializer):
    # user = UserSerializer()
    # deck = DeckSerializer()
    email = serializers.ReadOnlyField(source='user.email')

    # id = serializers.ReadOnlyField(write_only=True)
    class Meta:
        model = UserDeckRole
        # fields = ('id', 'user', 'deck', 'user_role', 'streaks')
        fields = ('id', 'email', 'role', 'streaks')


class UpdateRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserDeckRole
        fields = ('role',)

class AddUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()

    class Meta:
        model = UserDeckRole
        # fields = ('id', 'user', 'deck', 'user_role', 'streaks')
        fields = ('email', 'role')


class RemoveUserSerializer(serializers.Serializer):
    email = serializers.EmailField()

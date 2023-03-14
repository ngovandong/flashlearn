from rest_framework import serializers
from ..models import Deck
from . import UserDeckRoleSerializer


class DeckSerializer(serializers.ModelSerializer):
    user_roles = UserDeckRoleSerializer(read_only=True, many=True, )

    class Meta:
        model = Deck
        fields = ('id', 'name', 'description', 'user_roles', 'created_at', 'updated_at')




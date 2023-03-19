from rest_framework import serializers
from ..models import Deck
from . import UserDeckRoleSerializer, UserSerializer, TermNestInDeckSerializer


class DeckSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Deck
        fields = ('id', 'name', 'description', 'owner', 'created_at', 'updated_at')


class DeckDetailSerializer(DeckSerializer):
    terms = TermNestInDeckSerializer(many=True)
    user_roles = UserDeckRoleSerializer(read_only=True, many=True, )

    class Meta(DeckSerializer.Meta):
        fields = (*DeckSerializer.Meta.fields, 'terms', 'user_roles')


class MyDeckSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Deck
        fields = ('id', 'name', 'description', 'owner', 'created_at', 'updated_at')

    def to_representation(self, instance):
        user = self.context['request'].user
        ret = super().to_representation(instance)
        if instance.owner == user:
            ret["my_permission"] = "O"
        else:
            ret["my_permission"] = instance.user_roles.get(user=user).role
        return ret

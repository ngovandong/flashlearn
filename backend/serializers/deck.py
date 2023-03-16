from rest_framework import serializers
from ..models import Deck
from . import UserDeckRoleSerializer, UserSerializer
from django.conf import settings


class DeckSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    background = serializers.ImageField(required=False)

    class Meta:
        model = Deck
        fields = ('id', 'name', 'description', 'is_public', 'owner', 'number_of_term',
                  'created_at', 'updated_at', 'background')


class DeckDetailSerializer(DeckSerializer):
    user_roles = UserDeckRoleSerializer(read_only=True, many=True, )

    class Meta(DeckSerializer.Meta):
        fields = (*DeckSerializer.Meta.fields, 'user_roles')


class MyDeckSerializer(DeckSerializer):
    def to_representation(self, instance):
        user = self.context['request'].user
        ret = super().to_representation(instance)
        if instance.owner == user:
            ret["my_permission"] = "O"
        else:
            ret["my_permission"] = instance.user_roles.get(user=user).role
        return ret

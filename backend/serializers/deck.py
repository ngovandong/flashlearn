from rest_framework import serializers
from ..models import Deck
from . import AddUserSerializer, UserSerializer, ProgressSerializer
from ..constants import FULL_ROLE_CHOICES
from ..services import LearningService


class DeckSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    background = serializers.ImageField(required=False)

    class Meta:
        model = Deck
        fields = ('id', 'name', 'description', 'is_public', 'owner', 'number_of_term',
                  'created_at', 'updated_at', 'background')


class DeckDetailSerializer(DeckSerializer):
    user_roles = AddUserSerializer(read_only=True, many=True)
    learning_progress = ProgressSerializer(read_only=True)
    my_permission = serializers.ChoiceField(
        choices=FULL_ROLE_CHOICES, read_only=True)

    class Meta(DeckSerializer.Meta):
        fields = (*DeckSerializer.Meta.fields, 'user_roles',
                  'my_permission', 'learning_progress')

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context['request']
        user = request.user
        permission = instance.get_user_permission(user)
        if permission is not None:
            ret["my_permission"] = permission
        ret['learning_progress'] = LearningService.get_learning_progress(
            instance.id, user)
        return ret


class MyDeckSerializer(DeckSerializer):
    def to_representation(self, instance):
        user = self.context['request'].user
        ret = super().to_representation(instance)
        permission = instance.get_user_permission(user)
        if permission:
            ret["my_permission"] = permission
        return ret

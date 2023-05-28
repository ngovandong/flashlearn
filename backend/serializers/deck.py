from rest_framework import serializers
from django.db.models import Prefetch
from django.conf import settings
from ..models import Deck, UserDeckRole
from . import AddUserSerializer, UserSerializer, ProgressSerializer
from ..constants import FULL_ROLE_CHOICES
from ..services import LearningService


class DeckSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    background = serializers.ImageField(required=False)
    number_of_term = serializers.IntegerField(read_only=True)

    class Meta:
        model = Deck
        fields = ('id', 'name', 'description', 'is_public', 'owner', 'number_of_term',
                  'created_at', 'updated_at', 'background')

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if not ret.get("background"):
            ret["background"]= settings.BASE_BACKEND_URL + 'images/default_deck.jpg'
        return ret


class DeckDetailSerializer(DeckSerializer):
    user_roles = AddUserSerializer(read_only=True, many=True)
    learning_progress = ProgressSerializer(read_only=True)
    my_permission = serializers.ChoiceField(
        choices=FULL_ROLE_CHOICES, read_only=True)

    class Meta(DeckSerializer.Meta):
        fields = (*DeckSerializer.Meta.fields, 'user_roles',
                  'my_permission', 'learning_progress')

    def to_representation(self, instance):
        request = self.context['request']
        user = request.user
        ret = super().to_representation(instance)
        permission = instance.get_user_permission(user)
        ret["my_permission"] = permission
        ret["number_of_term"], ret['learning_progress'] = LearningService.get_learning_progress(
            instance.id, user)
        return ret


class MyDeckSerializer(DeckSerializer):
    learned = serializers.IntegerField(read_only=True)
    my_permission = serializers.ChoiceField(
        choices=FULL_ROLE_CHOICES, read_only=True)

    class Meta(DeckSerializer.Meta):
        fields = (*DeckSerializer.Meta.fields,
                  'my_permission', 'learned')

    def to_representation(self, instance):
        user = self.context['request'].user
        ret = super().to_representation(instance)
        return ret

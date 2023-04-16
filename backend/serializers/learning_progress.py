from rest_framework import serializers
from ..models import UserLearningProgress
from . import TermSerializer, UserSerializer


class UserLearningProgressSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    term = TermSerializer()

    class Meta:
        model = UserLearningProgress
        fields = ('id', 'user', 'term', 'last_learned_at', 'score')


class CreateLearningProgressSerializer(serializers.ModelSerializer):
    term_id = serializers.UUIDField()
    user_id = serializers.UUIDField()

    class Meta:
        model = UserLearningProgress
        fields = ('term_id', "user_id")


class ProgressSerializer(serializers.Serializer):
    learning = serializers.IntegerField()
    completed = serializers.IntegerField()
    left = serializers.IntegerField()

from rest_framework import serializers
from ..models import UserLearningProgress
from . import TermSerializer, UserSerializer


class UserLearningProgressSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    term = TermSerializer()

    class Meta:
        model = UserLearningProgress
        fields = ('id', 'user', 'term', 'last_learned_at', 'score')

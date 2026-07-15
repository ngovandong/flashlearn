from rest_framework import serializers

from ..models import CompetitionScore
from .term import TermSerializer


class CompetitionPoolSerializer(serializers.Serializer):
    deck_name = serializers.CharField()
    terms = TermSerializer(many=True)


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    player = serializers.SerializerMethodField()

    class Meta:
        model = CompetitionScore
        fields = ("player", "score", "updated_at")

    def get_player(self, obj):
        user = obj.user
        name = (user.name or "").strip() or user.get_full_name() or user.email
        return {"id": str(user.id), "name": name, "image_url": user.image_url}


class LeaderboardSerializer(serializers.Serializer):
    entries = LeaderboardEntrySerializer(many=True)
    my_score = serializers.IntegerField(allow_null=True)
    my_rank = serializers.IntegerField(allow_null=True)


class SubmitScoreSerializer(serializers.Serializer):
    deck_id = serializers.CharField()
    game_key = serializers.CharField()
    score = serializers.IntegerField(min_value=0)

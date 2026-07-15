from rest_framework import serializers

from ..models import WritingSession


class WritingSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WritingSession
        fields = [
            "id",
            "mode",
            "topic",
            "level",
            "tone",
            "messages",
            "draft",
            "feedback",
            "highlights",
            "starred",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

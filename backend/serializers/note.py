from rest_framework import serializers

from backend.models import Note


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ("id", "target_type", "target_key", "content", "title", "target_url", "updated_at")

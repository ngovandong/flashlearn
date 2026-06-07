from rest_framework import serializers

from ..models import Term


class TermSerializer(serializers.ModelSerializer):
    total_revisions = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Term
        fields = ("id", "name", "description", "image", "deck", "total_revisions")


class TermNestInDeckSerializer(serializers.ModelSerializer):
    image = serializers.URLField(allow_blank=True)

    class Meta:
        model = Term
        fields = ("id", "name", "description", "image")


class OnlyNameTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ("id", "name")


class ProgressTermSerializer(serializers.ModelSerializer):
    image = serializers.URLField(allow_blank=True)
    learning_progress_id = serializers.UUIDField(read_only=True)
    total_revisions = serializers.IntegerField(read_only=True)

    class Meta:
        model = Term
        fields = ("id", "name", "description", "image", "learning_progress_id", "total_revisions")


class ReviseTermSerializer(serializers.Serializer):
    all_terms = OnlyNameTermSerializer(many=True)
    revise_terms = ProgressTermSerializer(many=True)
    deck_name = serializers.CharField()


class LearningTermSerializer(serializers.Serializer):
    last_learned_index = serializers.IntegerField(required=False)
    terms = TermSerializer(many=True)


class AddTermsToDeckSerializer(serializers.Serializer):
    deck_id = serializers.UUIDField()
    terms = TermNestInDeckSerializer(many=True)

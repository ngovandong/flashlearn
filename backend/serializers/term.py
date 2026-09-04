from rest_framework import serializers

from ..models import Term

AI_FIELDS = (
    "word_type",
    "pronunciation",
    "definition",
    "synonyms",
    "antonyms",
    "examples",
    "word_forms",
    "word_family",
    "ai_filled",
)


class TermSerializer(serializers.ModelSerializer):
    total_revisions = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Term
        fields = ("id", "name", "meaning", "image", "deck", "total_revisions", *AI_FIELDS)


class TermWithProgressSerializer(TermSerializer):
    """`TermSerializer` plus the viewing user's progress row id, so Learn-mode
    "Got it" / "Still learning" actions have an id to PUT correct/incorrect
    against. Only `get_terms_for_deck(..., user=...)` annotates this field."""

    learning_progress_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta(TermSerializer.Meta):
        fields = (*TermSerializer.Meta.fields, "learning_progress_id")


class TermNestInDeckSerializer(serializers.ModelSerializer):
    image = serializers.URLField(allow_blank=True)

    class Meta:
        model = Term
        fields = ("id", "name", "meaning", "image", *AI_FIELDS)


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
        fields = ("id", "name", "meaning", "image", "learning_progress_id", "total_revisions")


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

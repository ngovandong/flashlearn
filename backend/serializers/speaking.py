from rest_framework import serializers

from ..models import SpeakingAnalysis, SpeakingConversation


class SpeakingConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpeakingConversation
        fields = [
            "id",
            "topic",
            "context",
            "accent",
            "level",
            "tone",
            "lines",
            "highlights",
            "starred",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SpeakingAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpeakingAnalysis
        fields = [
            "id",
            "conversation",
            "kind",
            "target_text",
            "transcription",
            "accuracy_score",
            "fluency_score",
            "completeness_score",
            "rhythm_score",
            "words_per_minute",
            "accent_analysis",
            "overall_feedback",
            "key_struggles",
            "word_analysis",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

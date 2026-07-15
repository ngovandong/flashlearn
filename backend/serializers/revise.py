"""Serializers for the Revise session.

A card is rendered *answer-free*: the client only ever receives the prompt and
the render payload (MCQ options, audio URL, blank count, the sentence to say).
The canonical answer stays server-side and is revealed only in the grade
response, so typed/spoken cards can't be peeked at.
"""

from rest_framework import serializers


class ReviseCardSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    kind = serializers.CharField(read_only=True)
    prompt = serializers.CharField(read_only=True)
    payload = serializers.JSONField(read_only=True)
    seen_count = serializers.IntegerField(read_only=True)
    mistake_count = serializers.IntegerField(read_only=True)

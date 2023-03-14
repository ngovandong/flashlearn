from rest_framework import serializers
from ..models import Term
from . import DeckSerializer


class TermSerializer(serializers.ModelSerializer):
    deck = DeckSerializer()

    class Meta:
        model = Term
        fields = ('id', 'term', 'description', 'image_url', 'deck')

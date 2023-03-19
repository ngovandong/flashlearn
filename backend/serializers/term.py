from rest_framework import serializers
from ..models import Term, Deck


class TermSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ('id', 'term', 'description', 'image_url', 'deck')


class TermNestInDeckSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ('id', 'term', 'description', 'image_url')


class AddTermsToDeckSerializer(serializers.ModelSerializer):
    deck_id = serializers.UUIDField()
    terms = TermNestInDeckSerializer(many=True)

    class Meta:
        model = Deck
        fields = ('deck_id', 'terms')

    def create(self, validated_data):
        deck_id = validated_data["deck_id"]
        terms_data = validated_data["terms"]

        terms = [Term(deck_id=deck_id, **term) for term in terms_data]
        Term.objects.bulk_create(terms)

        return {'message': 'Terms created successfully'}

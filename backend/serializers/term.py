from rest_framework import serializers
from django.core.files.uploadedfile import InMemoryUploadedFile
import cloudinary.uploader
from ..models import Term, Deck


class TermSerializer(serializers.ModelSerializer):
    image = serializers.URLField(allow_blank=True)

    class Meta:
        model = Term
        fields = ('id', 'name', 'description', 'image', 'deck')


class TermNestInDeckSerializer(serializers.ModelSerializer):
    image = serializers.URLField(allow_blank=True)

    class Meta:
        model = Term
        fields = ('id', 'name', 'description', 'image')


class AddTermsToDeckSerializer(serializers.ModelSerializer):
    deck_id = serializers.UUIDField()
    terms = TermNestInDeckSerializer(many=True)

    class Meta:
        model = Deck
        fields = ('deck_id', 'terms')

    def to_internal_value(self, data):
        parsed_dict = {
            'deck_id': data.get('deck_id', ''),
            'terms': []
        }

        for key, value in data.items():
            if key.startswith('terms'):
                term_index = int(key.split('[')[1].split(']')[0])
                term_property = key.split('[')[2].split(']')[0]
                if len(parsed_dict['terms']) < term_index + 1:
                    parsed_dict['terms'].append({})
                if term_property == 'name':
                    parsed_dict['terms'][term_index]['name'] = value
                elif term_property == 'description':
                    parsed_dict['terms'][term_index]['description'] = value
                elif term_property == 'image':
                    parsed_dict['terms'][term_index]['image'] = value
                    if isinstance(value, InMemoryUploadedFile):
                        # Convert the InMemoryUploadedFile to bytes
                        image_bytes = value.read()
                        # Post the bytes to Cloudinary and get the URL
                        result = cloudinary.uploader.upload(image_bytes)
                        parsed_dict['terms'][term_index]['image'] = result.get(
                            'url')
                    else:
                        parsed_dict['terms'][term_index]['image'] = value
        data = super().to_internal_value(parsed_dict)
        return data

    def is_valid(self, *, raise_exception=False):
        return super().is_valid(raise_exception=raise_exception)

    def create(self, validated_data):
        deck_id = validated_data["deck_id"]
        terms_data = validated_data["terms"]

        terms = [Term(deck_id=deck_id, **term) for term in terms_data]
        Term.objects.bulk_create(terms)

        return {'message': 'Terms created successfully'}

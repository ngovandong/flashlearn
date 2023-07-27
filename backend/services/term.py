from django.core.files.uploadedfile import InMemoryUploadedFile
import cloudinary.uploader
import re
import requests
import base64
from ..serializers import TermSerializer
from ..models import Term


class TermService:
    @classmethod
    def convert_form_ata_to_list_term(cls, formdata):
        parsed_data = []
        for key, value in formdata.items():
            term_index = int(re.findall(r'\d+', key)[0])
            term_property = key.split('[')[2].split(']')[0]
            if len(parsed_data) < term_index + 1:
                parsed_data.append({})
            if term_property == 'id':
                parsed_data[term_index]['id'] = value
            if term_property == 'name':
                parsed_data[term_index]['name'] = value
            elif term_property == 'description':
                parsed_data[term_index]['description'] = value
            elif term_property == 'image':
                parsed_data[term_index]['image'] = value
                if isinstance(value, InMemoryUploadedFile):
                    # Convert the InMemoryUploadedFile to bytes
                    image_bytes = value.read()
                    # Post the bytes to Cloudinary and get the URL
                    result = cloudinary.uploader.upload(image_bytes)
                    parsed_data[term_index]['image'] = result.get(
                        'url')
                else:
                    parsed_data[term_index]['image'] = value
        return parsed_data

    @classmethod
    def bulk_update_terms(cls, formdata):
        parsed_data = cls.convert_form_ata_to_list_term(formdata=formdata)
        serializer = TermSerializer(data=parsed_data, many=True, partial=True)
        serializer.is_valid(raise_exception=True)
        for item in serializer.validated_data:
            term = Term.objects.filter(id=item['id']).first()
            if term:
                term.name = item['name']
                term.description = item['description']
                term.image = item['image']
            term.save()

        return parsed_data

    @classmethod
    def get_revise_terms(cls, user, deck_id):
        all_terms = Term.objects.get_random_terms(deck_id)
        revise_terms = Term.objects.get_revise_terms(user, deck_id)
        return {"all_terms": all_terms, "revise_terms": revise_terms}

    @staticmethod
    def url_to_base64(image_url):
        # Send an HTTP GET request to the image URL
        response = requests.get(image_url)
        response.raise_for_status()

        # Read the image data
        image_data = response.content

        # Convert the image data to base64
        base64_data = base64.b64encode(image_data)

        # Decode the base64 data to a string
        base64_string = base64_data.decode('utf-8')

        # Add the base64 prefix based on the image format
        image_format = response.headers.get('content-type')
        if image_format:
            base64_string = f"data:{image_format};base64,{base64_string}"

        return base64_string

from rest_framework import views, status
from rest_framework.response import Response
import requests

GOOGLE_TRANSLATE_URL = "https://translate.google.com/translate_a/single"


class TranslateView(views.APIView):
    def post(self, request, format=None):
        text = request.data.get("text", "")
        source_language = request.data.get("source_language", "auto")
        target_language = request.data.get("target_language", "vi")
        translated_text = ""
        try:
            translated_text = self.translate_text(
                text, target_language, source_language)
        except:
            pass
        return Response(translated_text, status=status.HTTP_200_OK)

    def get_meaning_from_response(self, response):
        meaning = ""
        for line in response[0]:
            text = line[0]
            if text and isinstance(text, str):
                meaning += text
        return meaning

    def translate_text(self, text, target_language='vi', source_language='auto'):
        params = {
            'client': 'gtx',
            'sl': source_language,
            'tl': target_language,
            'hl': target_language,
            'dt': 't',
            'q': text,
        }
        response = requests.get(GOOGLE_TRANSLATE_URL, params=params)
        data = response.json()
        return self.get_meaning_from_response(data)

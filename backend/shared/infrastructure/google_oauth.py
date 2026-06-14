import io
from typing import Any

import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from rest_framework.parsers import JSONParser

from backend.constants import (
    GOOGLE_ACCESS_TOKEN_OBTAIN_URL,
    GOOGLE_ID_TOKEN_INFO_URL,
    GOOGLE_USER_INFO_URL,
)


class GoogleOAuthClient:
    def validate_id_token(self, id_token: str) -> dict[str, Any]:
        response = requests.get(GOOGLE_ID_TOKEN_INFO_URL, params={"id_token": id_token}, timeout=10)

        if not response.ok:
            raise ValidationError("id_token is invalid.")

        audience = response.json()["aud"]

        if audience != settings.GOOGLE_OAUTH2_CLIENT_ID:
            raise ValidationError("Invalid audience.")

        stream = io.BytesIO(response.content)
        return JSONParser().parse(stream)

    def get_access_token(self, code: str, redirect_uri: str) -> str:
        data = {
            "code": code,
            "client_id": settings.GOOGLE_OAUTH2_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH2_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }

        response = requests.post(GOOGLE_ACCESS_TOKEN_OBTAIN_URL, data=data, timeout=10)

        if not response.ok:
            raise ValidationError("Failed to obtain access token from Google.")

        return response.json()["access_token"]

    def get_user_info(self, access_token: str) -> dict[str, Any]:
        response = requests.get(GOOGLE_USER_INFO_URL, params={"access_token": access_token}, timeout=10)

        if not response.ok:
            raise ValidationError("Failed to obtain user info from Google.")

        return response.json()


default_oauth_client = GoogleOAuthClient()

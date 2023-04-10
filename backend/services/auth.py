import requests
import io
from typing import Dict, Any

from django.core.exceptions import ValidationError
from django.conf import settings
from django.contrib.auth.models import update_last_login

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.settings import api_settings
from rest_framework.parsers import JSONParser

from ..constants import GOOGLE_ID_TOKEN_INFO_URL, GOOGLE_ACCESS_TOKEN_OBTAIN_URL, GOOGLE_USER_INFO_URL
from ..serializers import UserSerializer
from ..models import User
from ..token import JWTToken


class AuthService:
    @classmethod
    def get_verify_email_token(cls, user: User):
        refresh = RefreshToken.for_user(user)
        return str(refresh)

    @classmethod
    def get_token(cls, user: User):
        token = {}
        refresh = RefreshToken.for_user(user)

        serializer = UserSerializer(instance=user)
        # append user to payload
        refresh["user"] = serializer.data

        token["refresh"] = str(refresh)
        token["access"] = str(refresh.access_token)

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)
        return token

    @classmethod
    def get_invite_token(cls, deck_id, role):
        payload = {"deck_id": deck_id, "role": role}
        return JWTToken.generate_token(payload)

    @classmethod
    def google_validate_id_token(cls, id_token: str) -> Dict:
        # Reference: https://developers.google.com/identity/sign-in/web/backend-auth#verify-the-integrity-of-the-id-token
        response = requests.get(
            GOOGLE_ID_TOKEN_INFO_URL,
            params={'id_token': id_token}
        )

        if not response.ok:
            raise ValidationError('id_token is invalid.')

        audience = response.json()['aud']

        if audience != settings.GOOGLE_OAUTH2_CLIENT_ID:
            raise ValidationError('Invalid audience.')

        stream = io.BytesIO(response.content)
        user_data = JSONParser().parse(stream)

        return user_data

    @classmethod
    def google_get_access_token(cls, code: str, redirect_uri: str) -> str:
        # Reference: https://developers.google.com/identity/protocols/oauth2/web-server#obtainingaccesstokens
        data = {
            'code': code,
            'client_id': settings.GOOGLE_OAUTH2_CLIENT_ID,
            'client_secret': settings.GOOGLE_OAUTH2_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }

        response = requests.post(GOOGLE_ACCESS_TOKEN_OBTAIN_URL, data=data)

        if not response.ok:
            raise ValidationError('Failed to obtain access token from Google.')

        access_token = response.json()['access_token']

        return access_token

    @classmethod
    def google_get_user_info(cls, access_token: str) -> Dict[str, Any]:
        # Reference: https://developers.google.com/identity/protocols/oauth2/web-server#callinganapi
        response = requests.get(
            GOOGLE_USER_INFO_URL,
            params={'access_token': access_token}
        )

        if not response.ok:
            raise ValidationError('Failed to obtain user info from Google.')

        return response.json()

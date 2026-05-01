from typing import Any

import jwt
from django.conf import settings
from jwt.exceptions import InvalidTokenError

ALGORITHM = "HS256"


class JWTToken:
    def __init__(self, token: str | None = None) -> None:
        self.token = token

    def get_token(self) -> str | None:
        return self.token

    def get_payload(self) -> dict[str, Any]:
        if self.token is None:
            raise AttributeError("Token has not been set")
        try:
            return jwt.decode(self.token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        except InvalidTokenError:
            raise ValueError("Invalid token")

    @classmethod
    def generate_token(cls, payload: dict[str, Any]) -> str:
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

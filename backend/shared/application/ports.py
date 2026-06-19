from typing import Any, Protocol


class CachePort(Protocol):
    def get(self, key: str) -> Any: ...

    def set(self, key: str, value: Any, timeout: int | None = None) -> None: ...

    def delete(self, key: str) -> None: ...

    def delete_pattern(self, pattern: str) -> None: ...


class ImageStoragePort(Protocol):
    def upload_bytes(self, data: bytes) -> str: ...

    def upload_file(self, file_obj) -> str: ...

    def upload_svg(self, svg_markup: str, public_id: str) -> str: ...

    def url_to_base64(self, url: str) -> str: ...


class OAuthPort(Protocol):
    def validate_id_token(self, id_token: str) -> dict[str, Any]: ...

    def get_access_token(self, code: str, redirect_uri: str) -> str: ...

    def get_user_info(self, access_token: str) -> dict[str, Any]: ...


class AiTextPort(Protocol):
    """Provider-agnostic text/JSON generation port.

    Implementations talk to a concrete LLM provider (Gemini, OpenAI, ...) and
    must return a parsed JSON object that conforms to ``schema`` when given.

    ``audio`` is an optional multimodal input ``{"mime_type": str, "data": str}``
    where ``data`` is base64-encoded audio bytes (used by the Speaking Coach for
    pronunciation analysis). Providers that cannot accept audio raise
    ``AiProviderError`` when it is supplied.
    """

    def generate_json(
        self,
        system: str,
        user: str,
        schema: dict[str, Any] | None = None,
        audio: dict[str, str] | None = None,
    ) -> dict[str, Any]: ...

class DomainError(Exception):
    """Base class for domain/application errors."""

    default_code = "domain_error"
    default_status = 400

    def __init__(self, message: str, *, code: str | None = None):
        self.message = message
        self.code = code or self.default_code
        super().__init__(message)


class NotFoundError(DomainError):
    default_code = "not_found"
    default_status = 404


class PermissionDeniedError(DomainError):
    default_code = "permission_denied"
    default_status = 400


class ConflictError(DomainError):
    default_code = "conflict"
    default_status = 400


class ValidationError(DomainError):
    default_code = "validation_error"
    default_status = 400

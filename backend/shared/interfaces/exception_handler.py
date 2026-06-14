from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from backend.shared.application.exceptions import DomainError


def domain_exception_handler(exc, context):
    if isinstance(exc, DomainError):
        payload = {"errors": exc.message}
        if exc.code != exc.default_code:
            payload["code"] = exc.code
        return Response(payload, status=exc.default_status)

    return drf_exception_handler(exc, context)

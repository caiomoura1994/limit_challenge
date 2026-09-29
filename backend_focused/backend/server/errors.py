from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler


class ProtectedResourceError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "This resource cannot be deleted because related records depend on it."
    )
    default_code = "protected_resource"


def api_exception_handler(exception, context):
    if isinstance(exception, ProtectedError):
        exception = ProtectedResourceError()

    return drf_exception_handler(exception, context)

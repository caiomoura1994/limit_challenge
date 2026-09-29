from django.db.models.deletion import ProtectedError
from rest_framework.views import exception_handler as drf_exception_handler

from server.errors import ProtectedResourceError


def api_exception_handler(exception, context):
    if isinstance(exception, ProtectedError):
        exception = ProtectedResourceError()

    return drf_exception_handler(exception, context)

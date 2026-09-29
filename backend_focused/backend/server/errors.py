from rest_framework import status
from rest_framework.exceptions import APIException


class ProtectedResourceError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "This resource cannot be deleted because related records depend on it."
    )
    default_code = "protected_resource"

from django.db.models.deletion import ProtectedError
from rest_framework.views import exception_handler as drf_exception_handler

from fleet.exception_handlers import handle_fleet_exception
from maintenance.exception_handlers import handle_maintenance_exception
from server.errors import ProtectedResourceError

APPLICATION_EXCEPTION_HANDLERS = (
    handle_fleet_exception,
    handle_maintenance_exception,
)


def api_exception_handler(exception, context):
    if isinstance(exception, ProtectedError):
        exception = ProtectedResourceError()
    else:
        for handler in APPLICATION_EXCEPTION_HANDLERS:
            handled_exception = handler(exception)
            if handled_exception is not None:
                exception = handled_exception
                break

    return drf_exception_handler(exception, context)

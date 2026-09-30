from django.db.models.deletion import ProtectedError
from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler as drf_exception_handler

from fleet.errors import VehicleConflictError
from maintenance.errors import (
    MaintenanceRecordRuleError,
    MechanicCertificationConflictError,
)
from server.errors import ProtectedResourceError

VEHICLE_CONFLICT_MESSAGES = {
    "vin": "A vehicle with this VIN already exists.",
    "license_plate": "This license plate is already assigned to an active vehicle.",
}
MECHANIC_CERTIFICATION_CONFLICT_MESSAGE = (
    "A mechanic with this certification number already exists."
)


def api_exception_handler(exception, context):
    if isinstance(exception, ProtectedError):
        exception = ProtectedResourceError()
    elif isinstance(exception, VehicleConflictError):
        exception = ValidationError(
            {field: VEHICLE_CONFLICT_MESSAGES[field] for field in exception.conflicts}
        )
    elif isinstance(exception, MechanicCertificationConflictError):
        exception = ValidationError(
            {"certification_number": [MECHANIC_CERTIFICATION_CONFLICT_MESSAGE]}
        )
    elif isinstance(exception, MaintenanceRecordRuleError):
        exception = ValidationError(exception.errors)

    return drf_exception_handler(exception, context)

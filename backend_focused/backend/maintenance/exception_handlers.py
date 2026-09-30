from rest_framework.exceptions import ValidationError

from maintenance.errors import (
    MaintenanceRecordRuleError,
    MechanicCertificationConflictError,
)

CERTIFICATION_CONFLICT_MESSAGE = (
    "A mechanic with this certification number already exists."
)


def handle_maintenance_exception(exception):
    if isinstance(exception, MechanicCertificationConflictError):
        return ValidationError(
            {"certification_number": [CERTIFICATION_CONFLICT_MESSAGE]}
        )

    if isinstance(exception, MaintenanceRecordRuleError):
        return ValidationError(exception.errors)

    return None

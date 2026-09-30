from rest_framework.exceptions import ValidationError

from fleet.errors import VehicleConflictError

CONFLICT_MESSAGES = {
    "vin": "A vehicle with this VIN already exists.",
    "license_plate": "This license plate is already assigned to an active vehicle.",
}


def handle_fleet_exception(exception):
    if not isinstance(exception, VehicleConflictError):
        return None

    return ValidationError(
        {field: CONFLICT_MESSAGES[field] for field in exception.conflicts}
    )

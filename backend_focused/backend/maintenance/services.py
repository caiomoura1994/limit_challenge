from datetime import date
from decimal import Decimal

from django.db import IntegrityError
from django.utils import timezone

from maintenance.errors import (
    MaintenanceRecordRuleError,
    MechanicCertificationConflictError,
)
from maintenance.models import MaintenanceRecord, Mechanic

FUTURE_DATE_MESSAGE = "Maintenance date cannot be in the future."
NEGATIVE_COST_MESSAGE = "Maintenance cost cannot be negative."


class MechanicService:
    def certification_number_exists(
        self,
        certification_number: str,
        exclude_mechanic_id: int | None = None,
    ) -> bool:
        mechanics = Mechanic.objects.filter(
            certification_number__iexact=certification_number
        )

        if exclude_mechanic_id is not None:
            mechanics = mechanics.exclude(pk=exclude_mechanic_id)

        return mechanics.exists()

    def create(self, data: dict) -> Mechanic:
        self._ensure_certification_number_is_available(data["certification_number"])

        try:
            return Mechanic.objects.create(**data)
        except IntegrityError as error:
            if self._is_certification_constraint_violation(error):
                raise MechanicCertificationConflictError() from error
            raise

    def update(self, mechanic: Mechanic, changes: dict) -> Mechanic:
        certification_number = changes.get(
            "certification_number",
            mechanic.certification_number,
        )
        self._ensure_certification_number_is_available(
            certification_number,
            exclude_mechanic_id=mechanic.id,
        )

        for field, value in changes.items():
            setattr(mechanic, field, value)

        if not changes:
            return mechanic

        try:
            mechanic.save(update_fields=[*changes, "updated_at"])
        except IntegrityError as error:
            if self._is_certification_constraint_violation(error):
                raise MechanicCertificationConflictError() from error
            raise

        return mechanic

    def _ensure_certification_number_is_available(
        self,
        certification_number: str,
        exclude_mechanic_id: int | None = None,
    ) -> None:
        if self.certification_number_exists(
            certification_number,
            exclude_mechanic_id=exclude_mechanic_id,
        ):
            raise MechanicCertificationConflictError()

    @staticmethod
    def _is_certification_constraint_violation(error: IntegrityError) -> bool:
        cause = error.__cause__
        diagnostic = getattr(cause, "diag", None)
        constraint_name = getattr(diagnostic, "constraint_name", None)

        return (
            constraint_name == "unique_mechanic_certification_ci"
            or "unique_mechanic_certification_ci" in str(error)
        )


class MaintenanceRecordService:
    def create(self, data: dict) -> MaintenanceRecord:
        self._validate_rules(
            maintenance_date=data["maintenance_date"],
            cost=data["cost"],
        )
        return MaintenanceRecord.objects.create(**data)

    def update(
        self,
        maintenance_record: MaintenanceRecord,
        changes: dict,
    ) -> MaintenanceRecord:
        self._validate_rules(
            maintenance_date=changes.get(
                "maintenance_date",
                maintenance_record.maintenance_date,
            ),
            cost=changes.get("cost", maintenance_record.cost),
        )

        for field, value in changes.items():
            setattr(maintenance_record, field, value)

        if changes:
            maintenance_record.save(update_fields=[*changes, "updated_at"])

        return maintenance_record

    @staticmethod
    def _validate_rules(maintenance_date: date, cost: Decimal) -> None:
        errors = {}

        if maintenance_date > timezone.localdate():
            errors["maintenance_date"] = [FUTURE_DATE_MESSAGE]

        if cost < Decimal("0.00"):
            errors["cost"] = [NEGATIVE_COST_MESSAGE]

        if errors:
            raise MaintenanceRecordRuleError(errors)

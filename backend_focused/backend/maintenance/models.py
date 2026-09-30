from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.functions import Lower

from maintenance.querysets import MaintenanceRecordQuerySet, MechanicQuerySet
from maintenance.validators import validate_not_future_date


class Mechanic(models.Model):
    name = models.CharField(max_length=255)
    certification_number = models.CharField(max_length=100)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = MechanicQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("certification_number"),
                name="unique_mechanic_certification_ci",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.certification_number})"


class MaintenanceRecord(models.Model):
    vehicle = models.ForeignKey(
        "fleet.Vehicle",
        on_delete=models.PROTECT,
        related_name="maintenance_records",
    )
    mechanic = models.ForeignKey(
        "maintenance.Mechanic",
        on_delete=models.PROTECT,
        related_name="maintenance_records",
    )
    maintenance_date = models.DateField(validators=[validate_not_future_date])
    maintenance_type = models.CharField(max_length=100)
    cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = MaintenanceRecordQuerySet.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cost__gte=0),
                name="maintenance_record_cost_non_negative",
            )
        ]

    def __str__(self) -> str:
        return (
            f"{self.vehicle} - {self.maintenance_type} "
            f"({self.maintenance_date:%Y-%m-%d})"
        )

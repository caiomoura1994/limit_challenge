from django.db import models

from maintenance.querysets import MaintenanceRecordQuerySet, MechanicQuerySet


class Mechanic(models.Model):
    name = models.CharField(max_length=255)
    certification_number = models.CharField(max_length=100)
    active = models.BooleanField(default=True)

    objects = MechanicQuerySet.as_manager()

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
    maintenance_date = models.DateField()
    maintenance_type = models.CharField(max_length=100)
    cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    notes = models.TextField(blank=True)

    objects = MaintenanceRecordQuerySet.as_manager()

    def __str__(self) -> str:
        return (
            f"{self.vehicle} - {self.maintenance_type} "
            f"({self.maintenance_date:%Y-%m-%d})"
        )

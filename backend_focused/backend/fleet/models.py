from django.db import models

from fleet.querysets import VehicleQuerySet


class Vehicle(models.Model):
    vin = models.CharField(max_length=17)
    license_plate = models.CharField(max_length=20)
    make = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    year = models.PositiveSmallIntegerField()
    office = models.ForeignKey(
        "offices.Office",
        on_delete=models.PROTECT,
        related_name="vehicles",
    )
    active = models.BooleanField(default=True)

    objects = VehicleQuerySet.as_manager()

    def __str__(self) -> str:
        return f"{self.make} {self.model} ({self.license_plate})"

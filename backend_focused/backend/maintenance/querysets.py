from decimal import Decimal

from django.db import models
from django.db.models import Count, DecimalField, Q, Sum


class MechanicQuerySet(models.QuerySet):
    def with_workload(self, year):
        maintenance_period = Q(maintenance_records__maintenance_date__year=year)

        return self.annotate(
            maintenance_count=Count(
                "maintenance_records",
                filter=maintenance_period,
            ),
            total_maintenance_cost=Sum(
                "maintenance_records__cost",
                filter=maintenance_period,
                default=Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        ).order_by("-maintenance_count", "id")


class MaintenanceRecordQuerySet(models.QuerySet):
    def for_vehicle(self, vehicle):
        return self.filter(vehicle=vehicle)

    def with_mechanic(self):
        return self.select_related("mechanic")

    def latest_first(self):
        return self.order_by("-maintenance_date", "-id")

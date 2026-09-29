from decimal import Decimal

from django.db import models
from django.db.models import Count, DecimalField, Max, Q, Sum


class OfficeQuerySet(models.QuerySet):
    def with_summary(self, maintenance_since):
        maintenance_period = Q(
            vehicles__maintenance_records__maintenance_date__gte=maintenance_since
        )

        return self.annotate(
            active_vehicle_count=Count(
                "vehicles",
                filter=Q(vehicles__active=True),
                distinct=True,
            ),
            maintenance_cost_last_year=Sum(
                "vehicles__maintenance_records__cost",
                filter=maintenance_period,
                default=Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
            last_maintenance=Max("vehicles__maintenance_records__maintenance_date"),
        ).order_by("id")

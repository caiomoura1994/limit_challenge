from django.db import models
from django.db.models import F, Max, Q


class VehicleQuerySet(models.QuerySet):
    def active(self):
        return self.filter(active=True)

    def with_office(self):
        return self.select_related("office")

    def with_last_maintenance(self):
        return self.annotate(
            last_maintenance=Max("maintenance_records__maintenance_date")
        )

    def needing_maintenance_before(self, cutoff):
        return self.filter(
            Q(last_maintenance__isnull=True) | Q(last_maintenance__lt=cutoff)
        ).order_by(
            F("last_maintenance").asc(nulls_first=True),
            "id",
        )

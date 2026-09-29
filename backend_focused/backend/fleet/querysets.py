from django.db import models
from django.db.models import F, Max, Prefetch, Q


class VehicleQuerySet(models.QuerySet):
    def active(self):
        return self.filter(active=True)

    def with_details(self):
        from maintenance.models import MaintenanceRecord

        return self.select_related("office").prefetch_related(
            Prefetch(
                "maintenance_records",
                queryset=MaintenanceRecord.objects.with_mechanic(),
            )
        )

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

    def maintained_between(self, start=None, end=None):
        maintenance_dates = {}

        if start:
            maintenance_dates["maintenance_records__maintenance_date__gte"] = start

        if end:
            maintenance_dates["maintenance_records__maintenance_date__lte"] = end

        return self.filter(**maintenance_dates).distinct()

    def by_mechanic_certification(self, certification_number):
        return self.filter(
            maintenance_records__mechanic__certification_number__iexact=(
                certification_number
            )
        ).distinct()

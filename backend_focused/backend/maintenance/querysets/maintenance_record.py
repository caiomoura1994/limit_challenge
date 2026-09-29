from django.db import models


class MaintenanceRecordQuerySet(models.QuerySet):
    def for_vehicle(self, vehicle):
        return self.filter(vehicle=vehicle)

    def with_mechanic(self):
        return self.select_related("mechanic")

    def latest_first(self):
        return self.order_by("-maintenance_date", "-id")

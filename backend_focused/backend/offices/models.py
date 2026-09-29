from django.db import models

from offices.querysets import OfficeQuerySet


class Office(models.Model):
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=255)

    objects = OfficeQuerySet.as_manager()

    def __str__(self) -> str:
        return f"{self.name} - {self.city}"

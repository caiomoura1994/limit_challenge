from django_filters import rest_framework as filters

from fleet.models import Vehicle
from fleet.querysets import VehicleQuerySet


class VehicleFilter(filters.FilterSet):
    office = filters.NumberFilter(field_name="office_id")
    active = filters.BooleanFilter()
    make = filters.CharFilter(lookup_expr="iexact")
    model = filters.CharFilter(lookup_expr="iexact")
    maintenance_date = filters.DateFromToRangeFilter(
        method="filter_maintenance_date",
    )
    mechanic_certification_number = filters.CharFilter(
        method="filter_mechanic_certification_number",
    )

    class Meta:
        model = Vehicle
        fields = []

    def filter_maintenance_date(
        self,
        queryset: VehicleQuerySet,
        name,
        value,
    ):
        start = value.start.date() if value.start else None
        end = value.stop.date() if value.stop else None

        return queryset.maintained_between(start=start, end=end)

    def filter_mechanic_certification_number(
        self,
        queryset: VehicleQuerySet,
        name,
        value,
    ):
        return queryset.by_mechanic_certification(value)

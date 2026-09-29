from django_filters import rest_framework as filters

from fleet.models import Vehicle


class VehicleFilter(filters.FilterSet):
    office = filters.NumberFilter(field_name="office_id")
    active = filters.BooleanFilter()
    make = filters.CharFilter(lookup_expr="iexact")
    model = filters.CharFilter(lookup_expr="iexact")
    maintenance_date = filters.DateFromToRangeFilter(
        field_name="maintenance_records__maintenance_date",
        distinct=True,
    )
    mechanic_certification_number = filters.CharFilter(
        field_name="maintenance_records__mechanic__certification_number",
        lookup_expr="iexact",
        distinct=True,
    )

    class Meta:
        model = Vehicle
        fields = []

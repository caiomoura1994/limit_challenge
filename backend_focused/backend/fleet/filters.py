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

    def filter_queryset(self, queryset):
        maintenance_filter_names = {
            "maintenance_date",
            "mechanic_certification_number",
        }

        for name, value in self.form.cleaned_data.items():
            if name not in maintenance_filter_names:
                queryset = self.filters[name].filter(queryset, value)

        maintenance_date = self.form.cleaned_data.get("maintenance_date")
        certification_number = self.form.cleaned_data.get(
            "mechanic_certification_number"
        )

        if not maintenance_date and not certification_number:
            return queryset

        maintenance_filters = {}

        if maintenance_date:
            if maintenance_date.start:
                maintenance_filters["maintenance_records__maintenance_date__gte"] = (
                    maintenance_date.start.date()
                )
            if maintenance_date.stop:
                maintenance_filters["maintenance_records__maintenance_date__lte"] = (
                    maintenance_date.stop.date()
                )

        if certification_number:
            maintenance_filters[
                "maintenance_records__mechanic__certification_number__iexact"
            ] = certification_number

        # One filter call makes every condition match the same maintenance record.
        return queryset.filter(**maintenance_filters).distinct()

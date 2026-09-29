from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from fleet.filters import VehicleFilter
from fleet.models import Vehicle
from fleet.querysets import VehicleQuerySet
from fleet.serializers import (
    VehicleAssignmentSerializer,
    VehicleDetailSerializer,
    VehicleDuplicateCheckSerializer,
    VehicleNeedingMaintenanceSerializer,
    VehicleSerializer,
)
from fleet.services import VehicleService
from maintenance.models import MaintenanceRecord
from maintenance.serializers import MaintenanceRecordSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset: VehicleQuerySet = Vehicle.objects.order_by("id")
    serializer_class = VehicleSerializer
    filterset_class = VehicleFilter

    def get_queryset(self):
        queryset: VehicleQuerySet = super().get_queryset()

        if self.action == "retrieve":
            return queryset.with_details()

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return VehicleDetailSerializer

        return super().get_serializer_class()

    @action(
        detail=True,
        methods=["get"],
        url_path="maintenance-history",
        serializer_class=MaintenanceRecordSerializer,
    )
    def maintenance_history(self, request, pk=None):
        vehicle = self.get_object()
        maintenance_records = MaintenanceRecord.objects.for_vehicle(
            vehicle
        ).latest_first()

        page = self.paginate_queryset(maintenance_records)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(maintenance_records, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="assign-office",
        serializer_class=VehicleAssignmentSerializer,
    )
    def assign_office(self, request, pk=None):
        vehicle = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        vehicle_service = VehicleService()
        vehicle_service.assign_office(
            vehicle=vehicle,
            office=serializer.validated_data["office"],
        )

        return Response(VehicleSerializer(vehicle).data)

    @action(
        detail=False,
        methods=["get"],
        url_path="needing-maintenance",
        serializer_class=VehicleNeedingMaintenanceSerializer,
    )
    def needing_maintenance(self, request):
        vehicle_service = VehicleService()
        vehicles = vehicle_service.find_needing_maintenance()

        page = self.paginate_queryset(vehicles)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(vehicles, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="duplicate-check",
        serializer_class=VehicleDuplicateCheckSerializer,
    )
    def duplicate_check(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        vehicle_service = VehicleService()
        conflicts = vehicle_service.find_conflicts(
            vin=serializer.validated_data["vin"],
            license_plate=serializer.validated_data["license_plate"],
        )

        return Response({"conflicts": conflicts})

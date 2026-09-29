from django.http import StreamingHttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
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
from fleet.streaming import stream_vehicle_detail
from maintenance.models import MaintenanceRecord
from maintenance.serializers import MaintenanceRecordSerializer


@extend_schema(tags=["Vehicles"])
class VehicleViewSet(viewsets.ModelViewSet):
    queryset: VehicleQuerySet = Vehicle.objects.order_by("-id")
    serializer_class = VehicleSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = VehicleFilter
    search_fields = ["vin", "license_plate", "make", "model"]

    def get_queryset(self):
        queryset: VehicleQuerySet = super().get_queryset()

        if self.action == "retrieve":
            return queryset.with_office()

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return VehicleDetailSerializer

        return super().get_serializer_class()

    @extend_schema(responses=VehicleDetailSerializer)
    def retrieve(self, request, *args, **kwargs):
        vehicle = self.get_object()
        maintenance_records = (
            MaintenanceRecord.objects.for_vehicle(vehicle)
            .with_mechanic()
            .latest_first()
        )
        return StreamingHttpResponse(
            stream_vehicle_detail(self.get_serializer(vehicle), maintenance_records),
            content_type="application/json",
        )

    @extend_schema(responses=MaintenanceRecordSerializer(many=True), filters=False)
    @action(
        detail=True,
        methods=["get"],
        url_path="maintenance-history",
        serializer_class=MaintenanceRecordSerializer,
        filter_backends=[],
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

    @extend_schema(responses=VehicleSerializer)
    @action(
        detail=True,
        methods=["post"],
        url_path="assign-office",
        serializer_class=VehicleAssignmentSerializer,
        filter_backends=[],
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

    @extend_schema(
        responses=VehicleNeedingMaintenanceSerializer(many=True),
        filters=False,
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="needing-maintenance",
        serializer_class=VehicleNeedingMaintenanceSerializer,
        filter_backends=[],
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

    @extend_schema(
        responses=inline_serializer(
            name="VehicleDuplicateCheckResult",
            fields={"conflicts": serializers.ListField(child=serializers.CharField())},
        ),
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="duplicate-check",
        serializer_class=VehicleDuplicateCheckSerializer,
        filter_backends=[],
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

from rest_framework import serializers

from fleet.models import Vehicle
from fleet.services import VehicleService
from maintenance.serializers import MaintenanceRecordDetailSerializer
from offices.models import Office
from offices.serializers import OfficeSerializer


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = "__all__"

    def create(self, validated_data):
        return VehicleService().create(validated_data)

    def update(self, instance, validated_data):
        return VehicleService().update(instance, validated_data)


class VehicleDetailSerializer(serializers.ModelSerializer):
    office = OfficeSerializer(read_only=True)
    maintenance_records = MaintenanceRecordDetailSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Vehicle
        fields = "__all__"


class VehicleAssignmentSerializer(serializers.Serializer):
    office = serializers.PrimaryKeyRelatedField(queryset=Office.objects.all())


class VehicleNeedingMaintenanceSerializer(serializers.ModelSerializer):
    last_maintenance = serializers.DateField(allow_null=True)

    class Meta:
        model = Vehicle
        fields = "__all__"


class VehicleDuplicateCheckSerializer(serializers.Serializer):
    vin = serializers.CharField(max_length=17)
    license_plate = serializers.CharField(max_length=20)

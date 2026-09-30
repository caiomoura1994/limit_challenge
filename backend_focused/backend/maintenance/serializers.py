from rest_framework import serializers

from maintenance.models import MaintenanceRecord, Mechanic
from maintenance.services import MaintenanceRecordService, MechanicService


class MechanicSerializer(serializers.ModelSerializer):
    certification_number = serializers.CharField(
        max_length=100,
    )

    class Meta:
        model = Mechanic
        fields = "__all__"

    def create(self, validated_data):
        return MechanicService().create(validated_data)

    def update(self, instance, validated_data):
        return MechanicService().update(instance, validated_data)


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    maintenance_date = serializers.DateField()
    cost = serializers.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        model = MaintenanceRecord
        fields = "__all__"

    def create(self, validated_data):
        return MaintenanceRecordService().create(validated_data)

    def update(self, instance, validated_data):
        return MaintenanceRecordService().update(instance, validated_data)


class MaintenanceRecordDetailSerializer(serializers.ModelSerializer):
    mechanic = MechanicSerializer(read_only=True)

    class Meta:
        model = MaintenanceRecord
        fields = "__all__"


class MechanicWorkloadSerializer(serializers.Serializer):
    name = serializers.CharField()
    maintenance_count = serializers.IntegerField()
    total_maintenance_cost = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
    )

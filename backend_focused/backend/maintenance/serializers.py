from rest_framework import serializers
from maintenance.models import MaintenanceRecord, Mechanic
from maintenance.services import (
    CERTIFICATION_CONFLICT_MESSAGE,
    MaintenanceRecordRuleError,
    MaintenanceRecordService,
    MechanicCertificationConflictError,
    MechanicService,
)


class MechanicSerializer(serializers.ModelSerializer):
    certification_number = serializers.CharField(
        max_length=100,
    )

    class Meta:
        model = Mechanic
        fields = "__all__"

    def create(self, validated_data):
        try:
            return MechanicService().create(validated_data)
        except MechanicCertificationConflictError as error:
            raise serializers.ValidationError(
                {"certification_number": [CERTIFICATION_CONFLICT_MESSAGE]}
            ) from error

    def update(self, instance, validated_data):
        try:
            return MechanicService().update(instance, validated_data)
        except MechanicCertificationConflictError as error:
            raise serializers.ValidationError(
                {"certification_number": [CERTIFICATION_CONFLICT_MESSAGE]}
            ) from error


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    maintenance_date = serializers.DateField()
    cost = serializers.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        model = MaintenanceRecord
        fields = "__all__"

    def create(self, validated_data):
        try:
            return MaintenanceRecordService().create(validated_data)
        except MaintenanceRecordRuleError as error:
            raise serializers.ValidationError(error.errors) from error

    def update(self, instance, validated_data):
        try:
            return MaintenanceRecordService().update(instance, validated_data)
        except MaintenanceRecordRuleError as error:
            raise serializers.ValidationError(error.errors) from error


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

from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from maintenance.models import MaintenanceRecord, Mechanic


class MechanicSerializer(serializers.ModelSerializer):
    certification_number = serializers.CharField(
        max_length=100,
        validators=[
            UniqueValidator(
                queryset=Mechanic.objects.all(),
                lookup="iexact",
                message="A mechanic with this certification number already exists.",
            )
        ],
    )

    class Meta:
        model = Mechanic
        fields = "__all__"


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceRecord
        fields = "__all__"


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

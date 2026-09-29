import json
from datetime import date

import pytest
from django.urls import reverse
from drf_spectacular.generators import SchemaGenerator
from rest_framework.exceptions import APIException
from rest_framework.permissions import BasePermission
from rest_framework.renderers import JSONRenderer
from rest_framework.test import APIClient

from fleet.models import Vehicle
from fleet.serializers import VehicleDetailSerializer
from fleet.streaming import DATABASE_CHUNK_SIZE, RESPONSE_CHUNK_BYTES
from fleet.views import VehicleViewSet
from maintenance.models import MaintenanceRecord, Mechanic
from maintenance.querysets import MaintenanceRecordQuerySet
from offices.models import Office


@pytest.fixture
def vehicle(db):
    office = Office.objects.create(name='Oficina "São João"', city="Salvador")
    return Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="STREAM-001",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )


@pytest.fixture
def mechanic(db):
    return Mechanic.objects.create(
        name="João 🛠️",
        certification_number="ASE-001",
    )


def test_stream_matches_detail_serializer_and_sorts_history(vehicle, mechanic):
    notes = 'Quoted "text", slash \\, newline\n\tand unicode: ação 🛠️\u2028\u2029'
    records = [
        MaintenanceRecord.objects.create(
            vehicle=vehicle,
            mechanic=mechanic,
            maintenance_date=maintenance_date,
            maintenance_type="Inspeção",
            cost="-100.25",
            notes=notes,
        )
        for maintenance_date in [date(2026, 1, 1), date(2025, 1, 1), date(2026, 1, 1)]
    ]
    expected = json.loads(JSONRenderer().render(VehicleDetailSerializer(vehicle).data))
    expected["maintenance_records"].sort(
        key=lambda record: (record["maintenance_date"], record["id"]), reverse=True
    )

    response = APIClient().get(reverse("vehicle-detail", args=[vehicle.id]))
    result = json.loads(b"".join(response.streaming_content))

    assert response.status_code == 200
    assert response.streaming
    assert response["Content-Type"] == "application/json"
    assert result == expected
    assert [record["id"] for record in result["maintenance_records"]] == [
        records[2].id,
        records[0].id,
        records[1].id,
    ]
    assert result["maintenance_records"][0]["notes"] == notes


def test_stream_preserves_notes_larger_than_response_chunk(vehicle, mechanic):
    notes = "🛠️" * RESPONSE_CHUNK_BYTES
    MaintenanceRecord.objects.create(
        vehicle=vehicle,
        mechanic=mechanic,
        maintenance_date=date(2026, 1, 1),
        maintenance_type="Inspection",
        cost="100.00",
        notes=notes,
    )

    response = APIClient().get(reverse("vehicle-detail", args=[vehicle.id]))
    result = json.loads(b"".join(response.streaming_content))

    assert result["maintenance_records"][0]["notes"] == notes


def test_stream_is_lazy_bounded_and_closes_on_disconnect(
    vehicle, mechanic, monkeypatch, django_assert_num_queries
):
    MaintenanceRecord.objects.bulk_create(
        [
            MaintenanceRecord(
                vehicle=vehicle,
                mechanic=mechanic,
                maintenance_date=date(2026, 1, 1),
                maintenance_type="Inspection",
                cost="100.00",
            )
            for _ in range(2200)
        ]
    )
    original_iterator = MaintenanceRecordQuerySet.iterator
    seen = []
    closed = []
    chunk_sizes = []

    def tracked_iterator(queryset, *, chunk_size):
        chunk_sizes.append(chunk_size)
        records = original_iterator(queryset, chunk_size=chunk_size)
        try:
            for record in records:
                seen.append(record.id)
                yield record
        finally:
            records.close()
            closed.append(True)

    monkeypatch.setattr(MaintenanceRecordQuerySet, "iterator", tracked_iterator)

    # Only the vehicle and office are queried before the first byte. No history
    # model instances or serializer representations are materialized eagerly.
    with django_assert_num_queries(1):
        response = APIClient().get(reverse("vehicle-detail", args=[vehicle.id]))
        chunks = iter(response.streaming_content)
        assert next(chunks).endswith(b'"maintenance_records":[')
        assert not seen

    with django_assert_num_queries(1):
        history_chunk = next(chunks)

    assert len(history_chunk) >= RESPONSE_CHUNK_BYTES
    assert 0 < len(seen) < DATABASE_CHUNK_SIZE
    assert chunk_sizes == [DATABASE_CHUNK_SIZE]
    assert not closed

    read_count = len(seen)
    response.close()

    assert closed == [True]
    assert len(seen) == read_count


@pytest.mark.django_db
def test_unknown_vehicle_is_a_regular_json_404():
    response = APIClient().get(reverse("vehicle-detail", args=[999999]))

    assert response.status_code == 404
    assert not response.streaming
    assert "detail" in response.data


def test_permissions_are_checked_before_streaming(vehicle, monkeypatch):
    class DenyVehicle(BasePermission):
        def has_object_permission(self, request, view, obj):
            return False

    monkeypatch.setattr(VehicleViewSet, "permission_classes", [DenyVehicle])

    response = APIClient().get(reverse("vehicle-detail", args=[vehicle.id]))

    assert response.status_code == 403
    assert not response.streaming


def test_envelope_is_serialized_before_streaming(vehicle, monkeypatch):
    def fail_representation(self, instance):
        raise APIException("Envelope serialization failed.")

    monkeypatch.setattr(
        VehicleDetailSerializer, "to_representation", fail_representation
    )

    response = APIClient().get(reverse("vehicle-detail", args=[vehicle.id]))

    assert response.status_code == 500
    assert not response.streaming
    assert response.data["detail"] == "Envelope serialization failed."


def test_detail_schema_still_documents_complete_json():
    schema = SchemaGenerator().get_schema(request=None, public=True)
    response = schema["paths"]["/api/vehicles/{id}/"]["get"]["responses"]["200"]

    assert response["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/VehicleDetail"
    }
    detail = schema["components"]["schemas"]["VehicleDetail"]["properties"]
    assert detail["maintenance_records"]["type"] == "array"
    assert detail["maintenance_records"]["items"] == {
        "$ref": "#/components/schemas/MaintenanceRecordDetail"
    }

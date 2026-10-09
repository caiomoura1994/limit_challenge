from datetime import date
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.urls import reverse
from django.utils import timezone

from fleet.management.commands import seed_performance
from fleet.models import Vehicle
from maintenance.models import MaintenanceRecord, Mechanic
from offices.models import Office
from server.test_utils import authenticated_client


@pytest.fixture
def small_performance_seed(monkeypatch):
    sizes = (2, 5, 9, 12)
    monkeypatch.setattr(seed_performance, "HISTORY_SIZES", sizes)
    monkeypatch.setattr(seed_performance, "BATCH_SIZE", 4)
    return sizes


@pytest.fixture
def existing_vehicle(db):
    office = Office.objects.create(name="Existing office", city="Salvador")
    mechanic = Mechanic.objects.create(
        name="Existing mechanic", certification_number="EXISTING-001"
    )
    vehicle = Vehicle.objects.create(
        vin="EXISTING000000001",
        license_plate="EXISTING-001",
        make="Honda",
        model="Civic",
        year=2022,
        office=office,
    )
    MaintenanceRecord.objects.create(
        vehicle=vehicle,
        mechanic=mechanic,
        maintenance_date=date(2025, 1, 15),
        maintenance_type="Original inspection",
        cost="99.50",
        notes="Keep this original record unchanged.",
    )
    return vehicle


def database_snapshot():
    return {
        model: list(model.objects.order_by("id").values())
        for model in (Office, Mechanic, Vehicle, MaintenanceRecord)
    }


def test_performance_seed_targets_requested_history_sizes():
    assert seed_performance.HISTORY_SIZES == (1000, 10000, 50000, 100000)
    assert seed_performance.BATCH_SIZE == 1000


@pytest.mark.django_db
def test_performance_seed_uses_descriptive_thousand_record_name(monkeypatch):
    monkeypatch.setattr(seed_performance, "HISTORY_SIZES", (1000,))

    call_command("seed_performance", stdout=StringIO())

    vehicle = Vehicle.objects.get()
    assert f"{vehicle.make} {vehicle.model}" == "Veiculo 1 mil registros"
    assert vehicle.license_plate == "PERF-001000"
    assert vehicle.maintenance_records.count() == 1000


@pytest.mark.django_db
def test_performance_seed_creates_named_vehicles_and_bounded_batches(
    small_performance_seed, monkeypatch
):
    batch_lengths = []
    original_bulk_create = MaintenanceRecord.objects.bulk_create

    def track_bulk_create(objects, *args, **kwargs):
        batch_lengths.append(len(objects))
        return original_bulk_create(objects, *args, **kwargs)

    monkeypatch.setattr(MaintenanceRecord.objects, "bulk_create", track_bulk_create)

    call_command("seed_performance", stdout=StringIO())

    assert Vehicle.objects.count() == len(small_performance_seed)
    assert Office.objects.count() == 1
    assert Mechanic.objects.count() == 1
    assert sum(batch_lengths) == sum(small_performance_seed)
    assert max(batch_lengths) == 4
    assert min(batch_lengths) < 4
    assert MaintenanceRecord.objects.count() == sum(small_performance_seed)

    for count in small_performance_seed:
        vehicle = Vehicle.objects.get(vin=f"PERF{count:013d}")
        assert vehicle.make == "Veiculo"
        assert vehicle.model == f"{count} registros"
        assert vehicle.license_plate == f"PERF-{count:06d}"
        assert vehicle.year == timezone.localdate().year
        assert vehicle.active is True
        assert vehicle.maintenance_records.count() == count
        assert not vehicle.maintenance_records.filter(mechanic__isnull=True).exists()
        assert not vehicle.maintenance_records.filter(
            maintenance_date__gt=timezone.localdate()
        ).exists()


@pytest.mark.django_db
def test_performance_seed_is_idempotent_and_preserves_existing_data(
    small_performance_seed, existing_vehicle
):
    existing = database_snapshot()

    call_command("seed_performance", stdout=StringIO())
    seeded = database_snapshot()
    call_command("seed_performance", stdout=StringIO())

    assert database_snapshot() == seeded
    for model, records in existing.items():
        assert all(record in seeded[model] for record in records)
    assert Vehicle.objects.count() == len(small_performance_seed) + 1
    assert MaintenanceRecord.objects.count() == sum(small_performance_seed) + 1


@pytest.mark.django_db
def test_performance_seed_only_completes_missing_history(small_performance_seed):
    call_command("seed_performance", stdout=StringIO())
    vehicle = Vehicle.objects.get(vin=f"PERF{12:013d}")
    removed_ids = list(vehicle.maintenance_records.values_list("id", flat=True)[:3])
    vehicle.maintenance_records.filter(id__in=removed_ids).delete()
    remaining = database_snapshot()

    call_command("seed_performance", stdout=StringIO())

    completed = database_snapshot()
    assert vehicle.maintenance_records.count() == 12
    assert MaintenanceRecord.objects.count() == sum(small_performance_seed)
    for model, records in remaining.items():
        assert all(record in completed[model] for record in records)
    for model in (Office, Mechanic, Vehicle):
        assert completed[model] == remaining[model]


@pytest.mark.django_db
def test_performance_seed_preserves_history_above_target(small_performance_seed):
    call_command("seed_performance", stdout=StringIO())
    vehicle = Vehicle.objects.get(vin=f"PERF{2:013d}")
    MaintenanceRecord.objects.create(
        vehicle=vehicle,
        mechanic=Mechanic.objects.get(),
        maintenance_date=date(2025, 1, 15),
        maintenance_type="Manually added inspection",
        cost="50.00",
        notes="Do not delete extra records to enforce the seed target.",
    )
    before = database_snapshot()

    call_command("seed_performance", stdout=StringIO(), stderr=StringIO())

    assert database_snapshot() == before
    assert vehicle.maintenance_records.count() == 3


@pytest.mark.django_db
def test_performance_seed_rejects_conflicting_vehicle_without_partial_writes(
    small_performance_seed, existing_vehicle
):
    existing_vehicle.vin = f"PERF{2:013d}".lower()
    existing_vehicle.save(update_fields=["vin"])
    before = database_snapshot()

    with pytest.raises(CommandError):
        call_command("seed_performance", stdout=StringIO())

    assert database_snapshot() == before


@pytest.mark.django_db
def test_performance_seed_vehicles_appear_first_in_list(
    small_performance_seed, existing_vehicle
):
    call_command("seed_performance", stdout=StringIO())

    response = authenticated_client().get(reverse("vehicle-list"))

    assert response.status_code == 200
    assert response.data["count"] == len(small_performance_seed) + 1
    results = response.data["results"]
    assert [vehicle["vin"] for vehicle in results[:4]] == [
        f"PERF{count:013d}" for count in small_performance_seed
    ]
    assert results[4]["id"] == existing_vehicle.id

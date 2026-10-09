from datetime import date

import pytest
from django.urls import reverse
from rest_framework import status

from fleet.models import Vehicle
from maintenance.models import MaintenanceRecord, Mechanic
from offices.models import Office
from server.test_utils import authenticated_client


@pytest.mark.django_db
def test_mechanic_search_combines_with_status_and_preserves_pagination():
    mechanics = Mechanic.objects.bulk_create(
        [
            Mechanic(name=f"Jane {index}", certification_number=f"ASE-{index:03d}")
            for index in range(12)
        ]
    )
    inactive = Mechanic.objects.create(
        name="Jane Smith", certification_number="ASE-INACTIVE", active=False
    )
    Mechanic.objects.create(name="John Doe", certification_number="OTHER")
    client = authenticated_client()
    url = reverse("mechanic-list")

    for search in ["jane", "ase-"]:
        response = client.get(url, {"search": search, "active": "true"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 12
        assert len(response.data["results"]) == 10
        second_page = client.get(url, {"search": search, "active": "true", "page": 2})
        assert [item["id"] for item in second_page.data["results"]] == [
            mechanic.id for mechanic in mechanics[10:]
        ]
        response = client.get(url, {"search": search, "active": "false"})
        assert response.data["count"] == 1
        assert response.data["results"][0]["id"] == inactive.id

    assert client.get(url).data["count"] == 14
    assert client.get(url, {"search": "", "active": ""}).data["count"] == 14
    assert (
        len(client.get(reverse("mechanic-workload"), {"search": "missing"}).data) == 14
    )


@pytest.fixture
def maintenance_search_data(db):
    office = Office.objects.create(name="Downtown", city="Boston")
    vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )
    other_vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004353",
        license_plate="XYZ-9876",
        make="Toyota",
        model="Corolla",
        year=2022,
        office=office,
    )
    mechanic = Mechanic.objects.create(
        name="Jane Smith", certification_number="ASE-001"
    )
    other_mechanic = Mechanic.objects.create(
        name="John Doe", certification_number="ASE-002"
    )
    records = MaintenanceRecord.objects.bulk_create(
        [
            MaintenanceRecord(
                vehicle=vehicle,
                mechanic=mechanic,
                maintenance_date=maintenance_date,
                maintenance_type="Oil change",
                cost="100.00",
                notes="Synthetic oil",
            )
            for maintenance_date in [
                date(2026, 1, 31),
                date(2026, 2, 1),
                date(2026, 2, 28),
            ]
        ]
    )
    other_record = MaintenanceRecord.objects.create(
        vehicle=other_vehicle,
        mechanic=other_mechanic,
        maintenance_date=date(2026, 3, 1),
        maintenance_type="Inspection",
        cost="50.00",
    )
    return vehicle, mechanic, records, other_record


@pytest.mark.parametrize("search", ["OIL", "synthetic", "abc-123", "004352", "jane"])
def test_maintenance_search_matches_text_and_related_resources(
    maintenance_search_data, search
):
    _, _, records, _ = maintenance_search_data
    response = authenticated_client().get(
        reverse("maintenance-record-list"), {"search": search}
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 3
    assert [item["id"] for item in response.data["results"]] == [
        record.id for record in records
    ]


@pytest.mark.parametrize(
    ("filters", "indexes"),
    [
        ({"maintenance_date_after": "2026-02-01"}, [1, 2, 3]),
        ({"maintenance_date_before": "2026-02-28"}, [0, 1, 2]),
        (
            {
                "maintenance_date_after": "2026-02-01",
                "maintenance_date_before": "2026-02-28",
            },
            [1, 2],
        ),
        (
            {
                "maintenance_date_after": "2026-02-01",
                "maintenance_date_before": "2026-02-01",
            },
            [1],
        ),
        ({}, [0, 1, 2, 3]),
        (
            {
                "maintenance_date_after": "",
                "maintenance_date_before": "",
                "vehicle": "",
                "mechanic": "",
                "search": "",
            },
            [0, 1, 2, 3],
        ),
    ],
)
def test_maintenance_date_filters_are_inclusive(
    maintenance_search_data, filters, indexes
):
    _, _, records, other_record = maintenance_search_data
    all_records = [*records, other_record]
    response = authenticated_client().get(reverse("maintenance-record-list"), filters)

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == len(indexes)
    assert [item["id"] for item in response.data["results"]] == [
        all_records[index].id for index in indexes
    ]


def test_maintenance_combined_filters_apply_before_pagination(maintenance_search_data):
    vehicle, mechanic, records, other_record = maintenance_search_data
    MaintenanceRecord.objects.bulk_create(
        [
            MaintenanceRecord(
                vehicle=vehicle,
                mechanic=mechanic,
                maintenance_date=date(2026, 2, 15),
                maintenance_type="Oil change",
                cost="100.00",
            )
            for _ in range(10)
        ]
    )
    filters = {
        "vehicle": vehicle.id,
        "mechanic": mechanic.id,
        "search": "oil",
        "maintenance_date_after": "2026-02-01",
        "maintenance_date_before": "2026-02-28",
    }
    client = authenticated_client()
    url = reverse("maintenance-record-list")
    response = client.get(url, filters)
    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 12
    assert len(response.data["results"]) == 10
    assert records[0].id not in [item["id"] for item in response.data["results"]]
    second_page = client.get(url, filters | {"page": 2})
    assert second_page.data["count"] == 12
    assert len(second_page.data["results"]) == 2
    assert second_page.data["next"] is None

    for overrides in [
        {"vehicle": other_record.vehicle_id},
        {"mechanic": other_record.mechanic_id},
    ]:
        assert client.get(url, filters | overrides).data["count"] == 0


@pytest.mark.parametrize("field", ["maintenance_date_after", "maintenance_date_before"])
def test_maintenance_rejects_invalid_date_filters(maintenance_search_data, field):
    response = authenticated_client().get(
        reverse("maintenance-record-list"), {field: "not-a-date"}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "maintenance_date" in response.data

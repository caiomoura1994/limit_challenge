from datetime import date, timedelta

import pytest
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from fleet.models import Vehicle
from fleet.services import VehicleService
from maintenance.models import MaintenanceRecord, Mechanic
from offices.models import Office


class VehicleApiTests(APITestCase):
    def setUp(self):
        self.office = Office.objects.create(name="Downtown Office", city="New York")

    def vehicle_payload(self, **overrides):
        payload = {
            "vin": "1HGCM82633A004352",
            "license_plate": "ABC-1234",
            "make": "Honda",
            "model": "Accord",
            "year": 2022,
            "office": self.office.id,
            "active": True,
        }
        return payload | overrides

    def test_vehicle_crud(self):
        create_response = self.client.post(
            reverse("vehicle-list"),
            self.vehicle_payload(),
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertIn("created_at", create_response.data)
        self.assertIn("updated_at", create_response.data)
        vehicle_id = create_response.data["id"]

        detail_url = reverse("vehicle-detail", args=[vehicle_id])
        detail_response = self.client.get(detail_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["office"]["id"], self.office.id)

        update_response = self.client.patch(
            detail_url,
            {"active": False},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertFalse(update_response.data["active"])

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_rejects_duplicate_vin(self):
        Vehicle.objects.create(
            **self.vehicle_payload(office=self.office),
        )

        response = self.client.post(
            reverse("vehicle-list"),
            self.vehicle_payload(
                vin="1hgcm82633a004352",
                license_plate="XYZ-9876",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vin", response.data)

    def test_rejects_duplicate_plate_between_active_vehicles(self):
        Vehicle.objects.create(
            **self.vehicle_payload(office=self.office),
        )

        response = self.client.post(
            reverse("vehicle-list"),
            self.vehicle_payload(vin="1HGCM82633A004353"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("license_plate", response.data)

    def test_allows_duplicate_plate_for_inactive_vehicle(self):
        Vehicle.objects.create(
            **self.vehicle_payload(office=self.office),
        )

        response = self.client.post(
            reverse("vehicle-list"),
            self.vehicle_payload(
                vin="1HGCM82633A004353",
                active=False,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rejects_activation_when_plate_belongs_to_active_vehicle(self):
        Vehicle.objects.create(
            **self.vehicle_payload(office=self.office),
        )
        inactive_vehicle = Vehicle.objects.create(
            **self.vehicle_payload(
                vin="1HGCM82633A004353",
                active=False,
                office=self.office,
            ),
        )

        response = self.client.patch(
            reverse("vehicle-detail", args=[inactive_vehicle.id]),
            {"active": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("license_plate", response.data)

    def test_rejects_deleting_vehicle_with_maintenance_records(self):
        vehicle = Vehicle.objects.create(
            **self.vehicle_payload(office=self.office),
        )
        mechanic = Mechanic.objects.create(
            name="Jane Smith",
            certification_number="ASE-001",
        )
        MaintenanceRecord.objects.create(
            vehicle=vehicle,
            mechanic=mechanic,
            maintenance_date=date(2026, 1, 1),
            maintenance_type="Inspection",
            cost="100.00",
        )

        response = self.client.delete(reverse("vehicle-detail", args=[vehicle.id]))

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            response.data["detail"],
            "This resource cannot be deleted because related records depend on it.",
        )
        self.assertTrue(Vehicle.objects.filter(id=vehicle.id).exists())


class VehicleConflictServiceTests(TestCase):
    def setUp(self):
        self.service = VehicleService()
        self.office = Office.objects.create(name="Downtown Office", city="New York")
        self.vehicle = Vehicle.objects.create(
            vin="1HGCM82633A004352",
            license_plate="ABC-1234",
            make="Honda",
            model="Accord",
            year=2022,
            office=self.office,
        )

    def test_finds_vin_and_active_license_plate_conflicts(self):
        conflicts = self.service.find_conflicts(
            vin="1hgcm82633a004352",
            license_plate="abc-1234",
        )

        self.assertEqual(conflicts, ["vin", "license_plate"])

    def test_can_exclude_current_vehicle(self):
        conflicts = self.service.find_conflicts(
            vin=self.vehicle.vin,
            license_plate=self.vehicle.license_plate,
            exclude_vehicle_id=self.vehicle.id,
        )

        self.assertEqual(conflicts, [])


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("vin", "license_plate"),
    [
        ("1hgcm82633a004352", "XYZ-9876"),
        ("1HGCM82633A004353", "abc-1234"),
    ],
    ids=["vin", "active-license-plate"],
)
def test_rejects_vehicle_conflicts_created_directly_in_database(
    vin,
    license_plate,
):
    office = Office.objects.create(name="Downtown Office", city="New York")
    Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        Vehicle.objects.create(
            vin=vin,
            license_plate=license_plate,
            make="Toyota",
            model="Corolla",
            year=2023,
            office=office,
        )


@pytest.fixture
def vehicle_search_data(db):
    primary_office = Office.objects.create(name="Downtown Office", city="New York")
    secondary_office = Office.objects.create(name="Uptown Office", city="Boston")

    honda = Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=primary_office,
    )
    toyota = Vehicle.objects.create(
        vin="1HGCM82633A004353",
        license_plate="XYZ-9876",
        make="Toyota",
        model="Corolla",
        year=2020,
        office=secondary_office,
        active=False,
    )
    ford = Vehicle.objects.create(
        vin="1HGCM82633A004354",
        license_plate="DEF-5678",
        make="Ford",
        model="Focus",
        year=2021,
        office=primary_office,
    )

    mechanic = Mechanic.objects.create(
        name="Jane Smith",
        certification_number="ASE-001",
    )
    other_mechanic = Mechanic.objects.create(
        name="John Smith",
        certification_number="ASE-999",
    )

    for maintenance_date in [date(2026, 2, 1), date(2026, 3, 1)]:
        MaintenanceRecord.objects.create(
            vehicle=honda,
            mechanic=mechanic,
            maintenance_date=maintenance_date,
            maintenance_type="Inspection",
            cost="100.00",
        )

    MaintenanceRecord.objects.create(
        vehicle=toyota,
        mechanic=mechanic,
        maintenance_date=date(2025, 1, 1),
        maintenance_type="Inspection",
        cost="100.00",
    )
    MaintenanceRecord.objects.create(
        vehicle=ford,
        mechanic=other_mechanic,
        maintenance_date=date(2026, 4, 1),
        maintenance_type="Inspection",
        cost="100.00",
    )

    return {
        "client": APIClient(),
        "primary_office": primary_office,
        "secondary_office": secondary_office,
        "mechanic": mechanic,
        "other_mechanic": other_mechanic,
        "honda": honda,
        "toyota": toyota,
        "ford": ford,
    }


@pytest.mark.parametrize(
    ("filter_name", "expected_vehicle"),
    [
        ("office", "toyota"),
        ("active", "toyota"),
        ("make", "honda"),
        ("model", "toyota"),
    ],
)
def test_filters_by_vehicle_fields(vehicle_search_data, filter_name, expected_vehicle):
    filter_values = {
        "office": vehicle_search_data["secondary_office"].id,
        "active": "false",
        "make": "honda",
        "model": "corolla",
    }

    response = vehicle_search_data["client"].get(
        reverse("vehicle-list"),
        {filter_name: filter_values[filter_name]},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == vehicle_search_data[expected_vehicle].id


@pytest.mark.parametrize(
    ("query_params", "expected_vehicles"),
    [
        ({"maintenance_date_after": "2026-01-01"}, {"honda", "ford"}),
        ({"maintenance_date_before": "2025-12-31"}, {"toyota"}),
        ({"mechanic_certification_number": "ase-001"}, {"honda", "toyota"}),
        (
            {
                "maintenance_date_after": "2026-01-01",
                "maintenance_date_before": "2026-12-31",
                "mechanic_certification_number": "ase-001",
            },
            {"honda"},
        ),
    ],
    ids=["date-after", "date-before", "mechanic", "combined"],
)
def test_filters_by_maintenance(
    vehicle_search_data,
    query_params,
    expected_vehicles,
):
    response = vehicle_search_data["client"].get(
        reverse("vehicle-list"),
        query_params,
    )

    expected_ids = {
        vehicle_search_data[vehicle_name].id for vehicle_name in expected_vehicles
    }
    response_ids = {vehicle["id"] for vehicle in response.data["results"]}

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == len(expected_ids)
    assert response_ids == expected_ids


def test_combined_maintenance_filters_must_match_the_same_record(vehicle_search_data):
    mixed = Vehicle.objects.create(
        vin="1HGCM82633A004355",
        license_plate="MIX-0001",
        make="Mazda",
        model="CX-5",
        year=2024,
        office=vehicle_search_data["primary_office"],
    )
    MaintenanceRecord.objects.create(
        vehicle=mixed,
        mechanic=vehicle_search_data["other_mechanic"],
        maintenance_date=date(2026, 2, 15),
        maintenance_type="Inspection",
        cost="100.00",
    )
    MaintenanceRecord.objects.create(
        vehicle=mixed,
        mechanic=vehicle_search_data["mechanic"],
        maintenance_date=date(2025, 2, 15),
        maintenance_type="Inspection",
        cost="100.00",
    )

    response = vehicle_search_data["client"].get(
        reverse("vehicle-list"),
        {
            "maintenance_date_after": "2026-01-01",
            "maintenance_date_before": "2026-12-31",
            "mechanic_certification_number": "ASE-001",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == vehicle_search_data["honda"].id


@pytest.mark.parametrize(
    "parameter",
    ["maintenance_date_after", "maintenance_date_before"],
)
def test_rejects_invalid_maintenance_date_filter(vehicle_search_data, parameter):
    response = vehicle_search_data["client"].get(
        reverse("vehicle-list"),
        {parameter: "not-a-date"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "maintenance_date" in response.data


@pytest.mark.parametrize("search", ["abc-123", "004352", "HONDA", "accord"])
def test_vehicle_search_combines_with_existing_filters(vehicle_search_data, search):
    client = vehicle_search_data["client"]
    response = client.get(
        reverse("vehicle-list"),
        {
            "search": search,
            "office": vehicle_search_data["primary_office"].id,
            "active": "true",
            "maintenance_date_after": "2026-02-01",
            "maintenance_date_before": "2026-03-01",
            "mechanic_certification_number": "ase-001",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == vehicle_search_data["honda"].id
    assert client.get(reverse("vehicle-list")).data["count"] == 3
    assert client.get(reverse("vehicle-list"), {"search": ""}).data["count"] == 3
    assert (
        client.get(reverse("vehicle-list"), {"search": search, "active": "false"}).data[
            "count"
        ]
        == 0
    )


def test_list_search_does_not_filter_vehicle_actions(vehicle_search_data):
    client = vehicle_search_data["client"]
    vehicle = vehicle_search_data["honda"]
    for url in [
        reverse("vehicle-maintenance-history", args=[vehicle.id]),
        reverse("vehicle-needing-maintenance"),
    ]:
        assert client.get(url, {"search": "missing"}).data == client.get(url).data


@pytest.mark.django_db
def test_vehicle_detail_includes_office_and_maintenance_history():
    office = Office.objects.create(name="Downtown Office", city="New York")
    vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )
    mechanic = Mechanic.objects.create(
        name="Jane Smith",
        certification_number="ASE-001",
    )

    for maintenance_date in [date(2025, 1, 1), date(2026, 1, 1)]:
        MaintenanceRecord.objects.create(
            vehicle=vehicle,
            mechanic=mechanic,
            maintenance_date=maintenance_date,
            maintenance_type="Inspection",
            cost="100.00",
            notes="Routine inspection",
        )

    response = APIClient().get(reverse("vehicle-detail", args=[vehicle.id]))

    assert response.status_code == status.HTTP_200_OK
    office_data = response.data["office"]
    assert {
        "id": office_data["id"],
        "name": office_data["name"],
        "city": office_data["city"],
    } == {
        "id": office.id,
        "name": office.name,
        "city": office.city,
    }
    assert office_data["created_at"] is not None
    assert office_data["updated_at"] is not None
    assert len(response.data["maintenance_records"]) == 2

    for maintenance_record in response.data["maintenance_records"]:
        assert maintenance_record["vehicle"] == vehicle.id
        mechanic_data = maintenance_record["mechanic"]
        assert {
            "id": mechanic_data["id"],
            "name": mechanic_data["name"],
            "certification_number": mechanic_data["certification_number"],
            "active": mechanic_data["active"],
        } == {
            "id": mechanic.id,
            "name": mechanic.name,
            "certification_number": mechanic.certification_number,
            "active": mechanic.active,
        }
        assert mechanic_data["created_at"] is not None
        assert mechanic_data["updated_at"] is not None


@pytest.mark.parametrize(
    "maintenance_count",
    [1, 300],
    ids=["single-record", "hundreds-of-records"],
)
@pytest.mark.django_db
def test_vehicle_detail_query_count_is_constant(
    django_assert_num_queries,
    maintenance_count,
):
    office = Office.objects.create(name="Downtown Office", city="New York")
    vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )
    mechanic = Mechanic.objects.create(
        name="Jane Smith",
        certification_number="ASE-001",
    )
    MaintenanceRecord.objects.bulk_create(
        [
            MaintenanceRecord(
                vehicle=vehicle,
                mechanic=mechanic,
                maintenance_date=date(2026, 1, 1),
                maintenance_type="Inspection",
                cost="100.00",
            )
            for _ in range(maintenance_count)
        ]
    )

    with django_assert_num_queries(2):
        response = APIClient().get(reverse("vehicle-detail", args=[vehicle.id]))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data["maintenance_records"]) == maintenance_count


@pytest.mark.django_db
def test_vehicle_maintenance_history_is_paginated_and_newest_first(
    django_assert_num_queries,
):
    office = Office.objects.create(name="Downtown Office", city="New York")
    vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )
    mechanic = Mechanic.objects.create(
        name="Jane Smith",
        certification_number="ASE-001",
    )
    maintenance_dates = [date(2026, 1, 1) + timedelta(days=day) for day in range(12)]

    for maintenance_date in maintenance_dates:
        MaintenanceRecord.objects.create(
            vehicle=vehicle,
            mechanic=mechanic,
            maintenance_date=maintenance_date,
            maintenance_type="Inspection",
            cost="100.00",
        )

    url = reverse("vehicle-maintenance-history", args=[vehicle.id])

    with django_assert_num_queries(3):
        response = APIClient().get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 12
    assert len(response.data["results"]) == 10
    assert response.data["next"] is not None
    assert [record["maintenance_date"] for record in response.data["results"]] == [
        maintenance_date.isoformat()
        for maintenance_date in reversed(maintenance_dates[2:])
    ]
    assert response.data["results"][0]["mechanic"] == mechanic.id

    second_page_response = APIClient().get(url, {"page": 2})

    assert second_page_response.status_code == status.HTTP_200_OK
    assert second_page_response.data["next"] is None
    assert [
        record["maintenance_date"] for record in second_page_response.data["results"]
    ] == [
        maintenance_date.isoformat()
        for maintenance_date in reversed(maintenance_dates[:2])
    ]


@pytest.mark.django_db
def test_assigns_vehicle_to_another_office():
    current_office = Office.objects.create(name="Downtown Office", city="New York")
    new_office = Office.objects.create(name="Uptown Office", city="Boston")
    vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=current_office,
    )
    previous_updated_at = vehicle.updated_at

    response = APIClient().post(
        reverse("vehicle-assign-office", args=[vehicle.id]),
        {"office": new_office.id},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["office"] == new_office.id

    vehicle.refresh_from_db()
    assert vehicle.office == new_office
    assert vehicle.updated_at > previous_updated_at


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"office": 999999},
    ],
    ids=["missing-office", "unknown-office"],
)
@pytest.mark.django_db
def test_rejects_invalid_vehicle_assignment(payload):
    office = Office.objects.create(name="Downtown Office", city="New York")
    vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )

    response = APIClient().post(
        reverse("vehicle-assign-office", args=[vehicle.id]),
        payload,
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "office" in response.data

    vehicle.refresh_from_db()
    assert vehicle.office == office


@pytest.mark.django_db
def test_assign_vehicle_returns_not_found_for_unknown_vehicle():
    office = Office.objects.create(name="Downtown Office", city="New York")

    response = APIClient().post(
        reverse("vehicle-assign-office", args=[999999]),
        {"office": office.id},
        format="json",
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_returns_active_vehicles_needing_maintenance(django_assert_num_queries):
    office = Office.objects.create(name="Downtown Office", city="New York")
    mechanic = Mechanic.objects.create(
        name="Jane Smith",
        certification_number="ASE-001",
    )

    def create_vehicle(identifier, active=True):
        return Vehicle.objects.create(
            vin=f"1HGCM82633A{identifier:06d}",
            license_plate=f"TEST-{identifier}",
            make="Honda",
            model="Accord",
            year=2022,
            office=office,
            active=active,
        )

    never_maintained = create_vehicle(1)
    oldest_maintenance = create_vehicle(2)
    old_maintenance = create_vehicle(3)
    recently_maintained = create_vehicle(4)
    boundary_maintenance = create_vehicle(5)
    inactive_vehicle = create_vehicle(6, active=False)
    today = timezone.localdate()

    maintenance_records = [
        (oldest_maintenance, today - timedelta(days=500)),
        (old_maintenance, today - timedelta(days=400)),
        (recently_maintained, today - timedelta(days=500)),
        (recently_maintained, today - timedelta(days=30)),
        (boundary_maintenance, today - timedelta(days=365)),
        (inactive_vehicle, today - timedelta(days=500)),
    ]
    MaintenanceRecord.objects.bulk_create(
        [
            MaintenanceRecord(
                vehicle=vehicle,
                mechanic=mechanic,
                maintenance_date=maintenance_date,
                maintenance_type="Inspection",
                cost="100.00",
            )
            for vehicle, maintenance_date in maintenance_records
        ]
    )

    with django_assert_num_queries(2):
        response = APIClient().get(reverse("vehicle-needing-maintenance"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 3
    assert [vehicle["id"] for vehicle in response.data["results"]] == [
        never_maintained.id,
        oldest_maintenance.id,
        old_maintenance.id,
    ]
    assert [vehicle["last_maintenance"] for vehicle in response.data["results"]] == [
        None,
        (today - timedelta(days=500)).isoformat(),
        (today - timedelta(days=400)).isoformat(),
    ]


@pytest.mark.parametrize(
    ("vin", "license_plate", "expected_conflicts"),
    [
        ("1HGCM82633A004999", "NO-CONFLICT", []),
        ("1hgcm82633a004352", "NO-CONFLICT", ["vin"]),
        ("1HGCM82633A004999", "abc-1234", ["license_plate"]),
        (
            "1hgcm82633a004352",
            "abc-1234",
            ["vin", "license_plate"],
        ),
    ],
    ids=["none", "vin", "license-plate", "both"],
)
@pytest.mark.django_db
def test_duplicate_vehicle_check(vin, license_plate, expected_conflicts):
    office = Office.objects.create(name="Downtown Office", city="New York")
    Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )

    response = APIClient().post(
        reverse("vehicle-duplicate-check"),
        {
            "vin": vin,
            "license_plate": license_plate,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data == {"conflicts": expected_conflicts}


@pytest.mark.parametrize(
    ("payload", "missing_field"),
    [
        ({"license_plate": "ABC-1234"}, "vin"),
        ({"vin": "1HGCM82633A004352"}, "license_plate"),
    ],
    ids=["missing-vin", "missing-license-plate"],
)
@pytest.mark.django_db
def test_duplicate_vehicle_check_requires_both_fields(payload, missing_field):
    response = APIClient().post(
        reverse("vehicle-duplicate-check"),
        payload,
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert missing_field in response.data

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from fleet.models import Vehicle
from maintenance.errors import (
    MaintenanceRecordRuleError,
    MechanicCertificationConflictError,
)
from maintenance.models import MaintenanceRecord, Mechanic
from maintenance.services import (
    MaintenanceRecordService,
    MechanicService,
)
from offices.models import Office


class MechanicApiTests(APITestCase):
    def test_mechanic_crud(self):
        create_response = self.client.post(
            reverse("mechanic-list"),
            {
                "name": "Jane Smith",
                "certification_number": "ASE-001",
                "active": True,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertIn("created_at", create_response.data)
        self.assertIn("updated_at", create_response.data)
        mechanic_id = create_response.data["id"]

        detail_url = reverse("mechanic-detail", args=[mechanic_id])
        detail_response = self.client.get(detail_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

        update_response = self.client.patch(
            detail_url,
            {"active": False},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertFalse(update_response.data["active"])

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_rejects_deleting_mechanic_with_maintenance_records(self):
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
        MaintenanceRecord.objects.create(
            vehicle=vehicle,
            mechanic=mechanic,
            maintenance_date=date(2026, 1, 1),
            maintenance_type="Inspection",
            cost="100.00",
        )

        response = self.client.delete(reverse("mechanic-detail", args=[mechanic.id]))

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            response.data["detail"],
            "This resource cannot be deleted because related records depend on it.",
        )
        self.assertTrue(Mechanic.objects.filter(id=mechanic.id).exists())

    def test_rejects_duplicate_certification_number_case_insensitively(self):
        mechanic = Mechanic.objects.create(
            name="Jane Smith",
            certification_number="ASE-001",
        )

        response = self.client.post(
            reverse("mechanic-list"),
            {
                "name": "John Smith",
                "certification_number": "ase-001",
                "active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["certification_number"][0],
            "A mechanic with this certification number already exists.",
        )

        update_response = self.client.patch(
            reverse("mechanic-detail", args=[mechanic.id]),
            {"certification_number": "ase-001"},
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)

    def test_database_rejects_duplicate_certification_number(self):
        Mechanic.objects.create(
            name="Jane Smith",
            certification_number="ASE-001",
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            Mechanic.objects.create(
                name="John Smith",
                certification_number="ase-001",
            )


class MaintenanceRecordApiTests(APITestCase):
    def setUp(self):
        office = Office.objects.create(name="Downtown Office", city="New York")
        self.vehicle = Vehicle.objects.create(
            vin="1HGCM82633A004352",
            license_plate="ABC-1234",
            make="Honda",
            model="Accord",
            year=2022,
            office=office,
        )
        self.mechanic = Mechanic.objects.create(
            name="Jane Smith",
            certification_number="ASE-001",
        )

    def test_maintenance_record_crud(self):
        create_response = self.client.post(
            reverse("maintenance-record-list"),
            {
                "vehicle": self.vehicle.id,
                "mechanic": self.mechanic.id,
                "maintenance_date": "2026-09-28",
                "maintenance_type": "Oil change",
                "cost": "125.50",
                "notes": "Synthetic oil",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertIn("created_at", create_response.data)
        self.assertIn("updated_at", create_response.data)
        record_id = create_response.data["id"]

        detail_url = reverse("maintenance-record-detail", args=[record_id])
        detail_response = self.client.get(detail_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["vehicle"], self.vehicle.id)
        self.assertEqual(detail_response.data["mechanic"], self.mechanic.id)

        update_response = self.client.patch(
            detail_url,
            {"cost": "150.00"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["cost"], "150.00")

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def maintenance_payload(self, **overrides):
        payload = {
            "vehicle": self.vehicle.id,
            "mechanic": self.mechanic.id,
            "maintenance_date": timezone.localdate().isoformat(),
            "maintenance_type": "Inspection",
            "cost": "0.00",
            "notes": "",
        }
        return payload | overrides

    def test_rejects_negative_cost_but_accepts_zero(self):
        rejected = self.client.post(
            reverse("maintenance-record-list"),
            self.maintenance_payload(cost="-0.01"),
            format="json",
        )

        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cost", rejected.data)

        accepted = self.client.post(
            reverse("maintenance-record-list"),
            self.maintenance_payload(),
            format="json",
        )

        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)

    def test_rejects_future_maintenance_date_but_accepts_today(self):
        tomorrow = timezone.localdate() + timedelta(days=1)
        rejected = self.client.post(
            reverse("maintenance-record-list"),
            self.maintenance_payload(maintenance_date=tomorrow.isoformat()),
            format="json",
        )

        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            rejected.data["maintenance_date"][0],
            "Maintenance date cannot be in the future.",
        )

        accepted = self.client.post(
            reverse("maintenance-record-list"),
            self.maintenance_payload(),
            format="json",
        )

        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)

    def test_database_rejects_negative_cost(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            MaintenanceRecord.objects.create(
                vehicle=self.vehicle,
                mechanic=self.mechanic,
                maintenance_date=timezone.localdate(),
                maintenance_type="Inspection",
                cost="-0.01",
            )


class MechanicServiceTests(TestCase):
    def test_rejects_case_insensitive_certification_conflicts(self):
        existing = Mechanic.objects.create(
            name="Jane Smith",
            certification_number="ASE-001",
        )
        service = MechanicService()

        with self.assertRaises(MechanicCertificationConflictError):
            service.create(
                {
                    "name": "John Smith",
                    "certification_number": "ase-001",
                }
            )

        other = Mechanic.objects.create(
            name="Mary Smith",
            certification_number="ASE-002",
        )
        with self.assertRaises(MechanicCertificationConflictError):
            service.update(
                other,
                {"certification_number": existing.certification_number.lower()},
            )

    def test_translates_database_race_for_certification_number(self):
        constraint_error = IntegrityError(
            "UNIQUE constraint failed: index " "'unique_mechanic_certification_ci'"
        )

        with (
            patch.object(
                MechanicService,
                "certification_number_exists",
                return_value=False,
            ),
            patch(
                "maintenance.services.Mechanic.objects.create",
                side_effect=constraint_error,
            ),
            self.assertRaises(MechanicCertificationConflictError),
        ):
            MechanicService().create(
                {
                    "name": "Jane Smith",
                    "certification_number": "ASE-001",
                }
            )


class MaintenanceRecordServiceTests(TestCase):
    def setUp(self):
        office = Office.objects.create(name="Downtown Office", city="New York")
        self.vehicle = Vehicle.objects.create(
            vin="1HGCM82633A004352",
            license_plate="ABC-1234",
            make="Honda",
            model="Accord",
            year=2022,
            office=office,
        )
        self.mechanic = Mechanic.objects.create(
            name="Jane Smith",
            certification_number="ASE-001",
        )

    def test_rejects_future_date_and_negative_cost(self):
        with self.assertRaises(MaintenanceRecordRuleError) as raised:
            MaintenanceRecordService().create(
                {
                    "vehicle": self.vehicle,
                    "mechanic": self.mechanic,
                    "maintenance_date": timezone.localdate() + timedelta(days=1),
                    "maintenance_type": "Inspection",
                    "cost": Decimal("-0.01"),
                }
            )

        self.assertEqual(
            raised.exception.errors,
            {
                "maintenance_date": ["Maintenance date cannot be in the future."],
                "cost": ["Maintenance cost cannot be negative."],
            },
        )
        self.assertFalse(MaintenanceRecord.objects.exists())

    def test_rejects_invalid_partial_update(self):
        record = MaintenanceRecord.objects.create(
            vehicle=self.vehicle,
            mechanic=self.mechanic,
            maintenance_date=timezone.localdate(),
            maintenance_type="Inspection",
            cost="100.00",
        )

        with self.assertRaises(MaintenanceRecordRuleError):
            MaintenanceRecordService().update(
                record,
                {"cost": Decimal("-0.01")},
            )

        record.refresh_from_db()
        self.assertEqual(record.cost, Decimal("100.00"))


@pytest.mark.django_db
def test_mechanic_workload_for_current_year(django_assert_num_queries):
    office = Office.objects.create(name="Downtown Office", city="New York")
    vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )
    busiest_mechanic = Mechanic.objects.create(
        name="Jane Smith",
        certification_number="ASE-001",
    )
    less_busy_mechanic = Mechanic.objects.create(
        name="John Smith",
        certification_number="ASE-002",
    )
    available_mechanic = Mechanic.objects.create(
        name="Mary Smith",
        certification_number="ASE-003",
    )
    current_year = timezone.localdate().year

    for cost in ["100.00", "250.50"]:
        MaintenanceRecord.objects.create(
            vehicle=vehicle,
            mechanic=busiest_mechanic,
            maintenance_date=date(current_year, 1, 15),
            maintenance_type="Inspection",
            cost=cost,
        )

    MaintenanceRecord.objects.create(
        vehicle=vehicle,
        mechanic=busiest_mechanic,
        maintenance_date=date(current_year - 1, 12, 15),
        maintenance_type="Old inspection",
        cost="1000.00",
    )
    MaintenanceRecord.objects.create(
        vehicle=vehicle,
        mechanic=less_busy_mechanic,
        maintenance_date=date(current_year, 2, 15),
        maintenance_type="Oil change",
        cost="75.25",
    )

    with django_assert_num_queries(1):
        response = APIClient().get(reverse("mechanic-workload"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data == [
        {
            "name": busiest_mechanic.name,
            "maintenance_count": 2,
            "total_maintenance_cost": "350.50",
        },
        {
            "name": less_busy_mechanic.name,
            "maintenance_count": 1,
            "total_maintenance_cost": "75.25",
        },
        {
            "name": available_mechanic.name,
            "maintenance_count": 0,
            "total_maintenance_cost": "0.00",
        },
    ]

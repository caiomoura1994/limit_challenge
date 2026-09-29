from datetime import date

import pytest
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from fleet.models import Vehicle
from maintenance.models import MaintenanceRecord, Mechanic
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

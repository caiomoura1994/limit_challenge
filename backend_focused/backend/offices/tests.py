from datetime import timedelta

import pytest
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from fleet.models import Vehicle
from maintenance.models import MaintenanceRecord, Mechanic
from offices.models import Office


class OfficeApiTests(APITestCase):
    def test_office_crud(self):
        create_response = self.client.post(
            reverse("office-list"),
            {"name": "Downtown Office", "city": "New York"},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        office_id = create_response.data["id"]

        detail_url = reverse("office-detail", args=[office_id])
        detail_response = self.client.get(detail_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["city"], "New York")

        update_response = self.client.patch(
            detail_url,
            {"city": "Boston"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["city"], "Boston")

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_rejects_deleting_office_with_assigned_vehicles(self):
        office = Office.objects.create(name="Downtown Office", city="New York")
        Vehicle.objects.create(
            vin="1HGCM82633A004352",
            license_plate="ABC-1234",
            make="Honda",
            model="Accord",
            year=2022,
            office=office,
        )

        response = self.client.delete(reverse("office-detail", args=[office.id]))

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            response.data["detail"],
            "This resource cannot be deleted because related records depend on it.",
        )
        self.assertTrue(Office.objects.filter(id=office.id).exists())


@pytest.mark.django_db
def test_office_summary(django_assert_num_queries):
    office = Office.objects.create(name="Downtown Office", city="New York")
    empty_office = Office.objects.create(name="Uptown Office", city="Boston")
    active_vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004352",
        license_plate="ABC-1234",
        make="Honda",
        model="Accord",
        year=2022,
        office=office,
    )
    inactive_vehicle = Vehicle.objects.create(
        vin="1HGCM82633A004353",
        license_plate="XYZ-9876",
        make="Toyota",
        model="Corolla",
        year=2020,
        office=office,
        active=False,
    )
    mechanic = Mechanic.objects.create(
        name="Jane Smith",
        certification_number="ASE-001",
    )

    today = timezone.localdate()
    recent_maintenance_date = today - timedelta(days=5)

    MaintenanceRecord.objects.create(
        vehicle=active_vehicle,
        mechanic=mechanic,
        maintenance_date=today - timedelta(days=30),
        maintenance_type="Oil change",
        cost="100.00",
    )
    MaintenanceRecord.objects.create(
        vehicle=inactive_vehicle,
        mechanic=mechanic,
        maintenance_date=recent_maintenance_date,
        maintenance_type="Inspection",
        cost="50.00",
    )
    MaintenanceRecord.objects.create(
        vehicle=active_vehicle,
        mechanic=mechanic,
        maintenance_date=today - timedelta(days=400),
        maintenance_type="Transmission repair",
        cost="1000.00",
    )

    with django_assert_num_queries(1):
        response = APIClient().get(reverse("office-summary"))

    assert response.status_code == status.HTTP_200_OK

    summaries = {summary["name"]: summary for summary in response.data}
    assert summaries[office.name] == {
        "name": office.name,
        "city": office.city,
        "active_vehicle_count": 1,
        "maintenance_cost_last_year": "150.00",
        "last_maintenance": recent_maintenance_date.isoformat(),
    }
    assert summaries[empty_office.name] == {
        "name": empty_office.name,
        "city": empty_office.city,
        "active_vehicle_count": 0,
        "maintenance_cost_last_year": "0.00",
        "last_maintenance": None,
    }

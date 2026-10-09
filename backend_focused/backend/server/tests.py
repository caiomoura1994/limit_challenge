from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class HealthCheckTests(SimpleTestCase):
    def test_returns_ok_without_accessing_the_database(self):
        response = self.client.get(reverse("health-check"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


class ApiDocumentationTests(SimpleTestCase):
    def test_schema_describes_list_filters(self):
        response = self.client.get(
            reverse("api-schema"),
            HTTP_ACCEPT="application/vnd.oai.openapi+json",
        )
        paths = response.json()["paths"]

        for resource, names in [
            ("offices", {"page", "search"}),
            ("mechanics", {"page", "search", "active"}),
            (
                "maintenance-records",
                {
                    "page",
                    "search",
                    "vehicle",
                    "mechanic",
                    "maintenance_date_after",
                    "maintenance_date_before",
                },
            ),
            (
                "vehicles",
                {
                    "page",
                    "search",
                    "office",
                    "active",
                    "make",
                    "model",
                    "maintenance_date_after",
                    "maintenance_date_before",
                    "mechanic_certification_number",
                },
            ),
        ]:
            with self.subTest(resource=resource):
                parameters = paths[f"/api/{resource}/"]["get"]["parameters"]
                self.assertEqual({parameter["name"] for parameter in parameters}, names)
                self.assertTrue(
                    all(parameter["in"] == "query" for parameter in parameters)
                )

    def test_swagger_documentation_is_available(self):
        response = self.client.get(reverse("api-docs"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Fleet Maintenance API")

    def test_openapi_schema_is_available(self):
        response = self.client.get(
            reverse("api-schema"),
            HTTP_ACCEPT="application/vnd.oai.openapi+json",
        )

        self.assertEqual(response.status_code, 200)
        schema = response.json()
        self.assertEqual(schema["info"]["title"], "Fleet Maintenance API")
        self.assertEqual(schema["paths"]["/api/offices/"]["get"]["tags"], ["Offices"])
        self.assertEqual(
            schema["paths"]["/api/vehicles/"]["get"]["tags"],
            ["Vehicles"],
        )
        self.assertEqual(
            schema["paths"]["/api/mechanics/"]["get"]["tags"],
            ["Mechanics"],
        )
        self.assertEqual(
            schema["paths"]["/api/maintenance-records/"]["get"]["tags"],
            ["Maintenance Records"],
        )

        self.assertIn("jwtAuth", schema["components"]["securitySchemes"])

    def test_schema_describes_custom_response_shapes_and_write_fields(self):
        response = self.client.get(
            reverse("api-schema"),
            HTTP_ACCEPT="application/vnd.oai.openapi+json",
        )
        schema = response.json()

        for path, component in [
            ("/api/offices/summary/", "OfficeSummary"),
            ("/api/mechanics/workload/", "MechanicWorkload"),
        ]:
            with self.subTest(path=path):
                operation = schema["paths"][path]["get"]
                result = operation["responses"]["200"]["content"]["application/json"][
                    "schema"
                ]
                self.assertEqual(result["type"], "array")
                self.assertEqual(
                    result["items"]["$ref"], f"#/components/schemas/{component}"
                )
                self.assertNotIn("parameters", operation)

        for path, method, component in [
            (
                "/api/vehicles/{id}/maintenance-history/",
                "get",
                "PaginatedMaintenanceRecordList",
            ),
            (
                "/api/vehicles/needing-maintenance/",
                "get",
                "PaginatedVehicleNeedingMaintenanceList",
            ),
            ("/api/vehicles/{id}/assign-office/", "post", "Vehicle"),
            ("/api/vehicles/duplicate-check/", "post", "VehicleDuplicateCheckResult"),
        ]:
            with self.subTest(path=path):
                result = schema["paths"][path][method]["responses"]["200"]["content"][
                    "application/json"
                ]["schema"]
                self.assertEqual(result["$ref"], f"#/components/schemas/{component}")

        for component in ["Office", "Mechanic", "Vehicle", "MaintenanceRecord"]:
            with self.subTest(component=component):
                write_fields = schema["components"]["schemas"][f"{component}Request"][
                    "properties"
                ]
                self.assertNotIn("id", write_fields)
                self.assertNotIn("created_at", write_fields)
                self.assertNotIn("updated_at", write_fields)


class JwtAuthenticationTests(APITestCase):
    def setUp(self):
        self.password = "test-password"
        self.user = get_user_model().objects.create_user(
            username="test-user",
            password=self.password,
        )

    def test_api_requires_authentication(self):
        response = self.client.get(reverse("office-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_issues_and_refreshes_tokens(self):
        token_response = self.client.post(
            reverse("token-obtain-pair"),
            {"username": self.user.username, "password": self.password},
            format="json",
        )

        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", token_response.data)
        self.assertIn("refresh", token_response.data)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}"
        )
        self.assertEqual(
            self.client.get(reverse("office-list")).status_code,
            status.HTTP_200_OK,
        )

        refresh_response = self.client.post(
            reverse("token-refresh"),
            {"refresh": token_response.data["refresh"]},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_response.data)

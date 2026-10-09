import logging
import os
import random

from locust import HttpUser, between, events, task
from locust.exception import StopUser

MAX_FAILURE_RATIO = float(os.getenv("LOCUST_MAX_FAILURE_RATIO", "0.01"))
MAX_P95_MS = int(os.getenv("LOCUST_MAX_P95_MS", "1000"))
USERNAME = os.getenv("LOCUST_USERNAME")
PASSWORD = os.getenv("LOCUST_PASSWORD")


@events.quitting.add_listener
def enforce_performance_thresholds(environment, **kwargs):
    statistics = environment.stats.total
    failures = []

    if statistics.num_requests == 0:
        failures.append("no requests were completed")
    if statistics.fail_ratio > MAX_FAILURE_RATIO:
        failures.append(
            f"failure ratio {statistics.fail_ratio:.2%} exceeded "
            f"{MAX_FAILURE_RATIO:.2%}"
        )

    p95_response_time = statistics.get_response_time_percentile(0.95)
    if p95_response_time > MAX_P95_MS:
        failures.append(
            f"p95 response time {p95_response_time}ms exceeded {MAX_P95_MS}ms"
        )

    if failures:
        for failure in failures:
            logging.error("Load test threshold failed: %s", failure)
        environment.process_exit_code = 1


class FleetApiUser(HttpUser):
    wait_time = between(0.1, 0.5)

    def on_start(self):
        if not USERNAME or not PASSWORD:
            logging.error("LOCUST_USERNAME and LOCUST_PASSWORD are required")
            raise StopUser()

        with self.client.post(
            "/api/token/",
            json={"username": USERNAME, "password": PASSWORD},
            name="/api/token/ [setup]",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure("Could not authenticate the load-test user")
                raise StopUser()
            self.client.headers["Authorization"] = f"Bearer {response.json()['access']}"

        with self.client.get(
            "/api/vehicles/?page=1",
            name="/api/vehicles/ [setup]",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure("Could not load a vehicle for the load test")
                raise StopUser()

            vehicles = response.json().get("results", [])
            if not vehicles:
                response.failure("Seed data is required before running the load test")
                raise StopUser()

            self.vehicle_id = vehicles[0]["id"]

    @task(6)
    def vehicle_detail(self):
        with self.client.get(
            f"/api/vehicles/{self.vehicle_id}/",
            name="/api/vehicles/{id}/ [detail]",
            catch_response=True,
        ) as response:
            if (
                response.status_code == 200
                and "maintenance_records" not in response.json()
            ):
                response.failure("Vehicle detail did not include maintenance history")

    @task(4)
    def vehicle_maintenance_history(self):
        page = random.randint(1, 10)
        self.client.get(
            f"/api/vehicles/{self.vehicle_id}/maintenance-history/?page={page}",
            name="/api/vehicles/{id}/maintenance-history/",
        )

    @task(3)
    def vehicle_search(self):
        self.client.get(
            "/api/vehicles/?active=true&make=Toyota",
            name="/api/vehicles/ [search]",
        )

    @task
    def office_summary(self):
        self.client.get("/api/offices/summary/")

    @task
    def mechanic_workload(self):
        self.client.get("/api/mechanics/workload/")

    @task
    def vehicles_needing_maintenance(self):
        self.client.get("/api/vehicles/needing-maintenance/?page=1")

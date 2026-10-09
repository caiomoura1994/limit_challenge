from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase


def authenticated_client():
    client = APIClient()
    client.force_authenticate(user=get_user_model()(username="test-user"))
    return client


class AuthenticatedAPITestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(
            user=get_user_model()(username="test-user"),
        )

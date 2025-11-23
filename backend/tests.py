from django.test import TestCase, Client
from django.urls import reverse

class BasicConnectivityTest(TestCase):
    def setUp(self):
        self.client = Client()

    def test_admin_page_loads(self):
        """Test that the admin login page loads successfully."""
        response = self.client.get('/admin/login/')
        self.assertEqual(response.status_code, 200)

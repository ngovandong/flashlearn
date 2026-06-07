from django.test import Client, TestCase


class BasicConnectivityTest(TestCase):
    def setUp(self):
        self.client = Client()

    def test_admin_page_loads(self):
        """Test that the admin login page loads successfully."""
        response = self.client.get("/admin/login/")
        self.assertEqual(response.status_code, 200)

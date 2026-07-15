"""Contract tests for the endpoints the native (Expo) app depends on.

The mobile client can't read HttpOnly cookies, so it uses the *body* channel of
the existing Django auth endpoints: it reads the refresh token from the login /
Google-init response body, sends it in the body on refresh, and sends it in the
body on logout. These tests pin that body contract (plus the settings, reminders
and learning-streak response shapes the home/settings screens render) so a future
change to the web cookie flow can't silently break mobile.

No new mobile-only API is introduced — this guards the shared contract.
"""

from unittest import mock

from django.test import override_settings
from rest_framework.test import APITestCase

from backend.models import User


class EmailLoginBodyContractTest(APITestCase):
    def setUp(self):
        self.password = "pw12345!"
        self.user = User.objects.create_user("native@example.com", self.password, is_validated_email=True)

    def test_login_returns_access_refresh_and_user_in_body(self):
        res = self.client.post(
            "/api/users/login/",
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        # The native client reads all three from the body (no cookie access).
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        self.assertTrue(res.data["refresh"])
        self.assertEqual(res.data["user"]["email"], self.user.email)

    def test_login_unvalidated_email_is_rejected(self):
        User.objects.create_user("pending@example.com", self.password)
        res = self.client.post(
            "/api/users/login/",
            {"email": "pending@example.com", "password": self.password},
            format="json",
        )
        self.assertEqual(res.status_code, 400)


class BodyRefreshRotationContractTest(APITestCase):
    def setUp(self):
        self.password = "pw12345!"
        self.user = User.objects.create_user("refresh@example.com", self.password, is_validated_email=True)
        login = self.client.post(
            "/api/users/login/",
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        self.refresh = login.data["refresh"]

    def test_body_refresh_returns_new_access_and_rotated_refresh(self):
        # A fresh client so no refresh cookie leaks in — the token must be honored
        # purely from the request body, the way the device sends it.
        res = self.client.post("/api/users/refresh/", {"refresh": self.refresh}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        # ROTATE_REFRESH_TOKENS is on, so the rotated refresh must come back in the
        # body (not just a Set-Cookie) so the device can persist it to SecureStore.
        self.assertIn("refresh", res.data)
        self.assertTrue(res.data["refresh"])
        self.assertNotEqual(res.data["refresh"], self.refresh)

    def test_refresh_without_token_is_unauthorized(self):
        # A fresh client with no refresh cookie — the device never has one, so a
        # bodyless refresh must be rejected rather than silently succeeding.
        from rest_framework.test import APIClient

        res = APIClient().post("/api/users/refresh/", {}, format="json")
        self.assertEqual(res.status_code, 401)


class BodyLogoutContractTest(APITestCase):
    def setUp(self):
        self.password = "pw12345!"
        self.user = User.objects.create_user("logout@example.com", self.password, is_validated_email=True)
        login = self.client.post(
            "/api/users/login/",
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        self.refresh = login.data["refresh"]

    def test_body_logout_revokes_the_refresh_token(self):
        res = self.client.post("/api/users/logout/", {"refresh": self.refresh}, format="json")
        self.assertEqual(res.status_code, 205)

        # After a body logout the same refresh token must no longer mint access.
        reuse = self.client.post("/api/users/refresh/", {"refresh": self.refresh}, format="json")
        self.assertEqual(reuse.status_code, 401)


class GoogleInitBodyContractTest(APITestCase):
    def setUp(self):
        # Google accounts have no usable password (is_google_account == True). A
        # pre-existing user keeps the get-or-create path side-effect free.
        self.user = User.objects.create_user("gmail-user@example.com", None, is_validated_email=True)

    def test_init_exchanges_id_token_for_body_session(self):
        google_profile = {
            "email": self.user.email,
            "given_name": "G",
            "family_name": "User",
            "name": "G User",
            "picture": "",
        }
        with mock.patch(
            "backend.views.user.auth_service.google_validate_id_token",
            return_value=google_profile,
        ):
            res = self.client.get("/api/users/init/", HTTP_AUTHORIZATION="fake-google-id-token")

        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        # The device persists this body refresh to SecureStore, mirroring login.
        self.assertIn("refresh", res.data)
        self.assertTrue(res.data["refresh"])
        self.assertEqual(res.data["user"]["email"], self.user.email)

    def test_init_without_token_returns_400(self):
        res = self.client.get("/api/users/init/")
        self.assertEqual(res.status_code, 400)


class SettingsRoundTripContractTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("settings@example.com", "pw12345!", is_validated_email=True)
        self.client.force_authenticate(user=self.user)

    def test_patch_then_get_my_settings_round_trips(self):
        patch = self.client.patch(
            "/api/users/my_settings/",
            {
                "theme_mode": "dark",
                "theme_palette": "emerald",
                "reminder_email": "settings@example.com",
                "daily_reminder": True,
            },
            format="json",
        )
        self.assertEqual(patch.status_code, 200)
        self.assertEqual(patch.data.get("theme_mode"), "dark")

        get = self.client.get("/api/users/my_settings/")
        self.assertEqual(get.status_code, 200)
        self.assertEqual(get.data.get("theme_mode"), "dark")
        self.assertEqual(get.data.get("theme_palette"), "emerald")
        self.assertEqual(get.data.get("reminder_email"), "settings@example.com")

    def test_my_settings_requires_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/users/my_settings/").status_code, 401)


class ReminderAndStreakShapeTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("home@example.com", "pw12345!", is_validated_email=True)
        self.client.force_authenticate(user=self.user)

    def test_reminders_returns_a_list(self):
        res = self.client.get("/api/reminders/")
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.data, list)

    def test_learning_streak_shape_and_increment(self):
        res = self.client.get("/api/users/learning_streak/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {"streak": 0, "studied_today": False})

        recorded = self.client.post("/api/users/record_study/")
        self.assertEqual(recorded.status_code, 204)

        after = self.client.get("/api/users/learning_streak/")
        self.assertEqual(after.data["streak"], 1)
        self.assertTrue(after.data["studied_today"])


class GoogleAudienceValidationTest(APITestCase):
    """The token-info audience check must accept every configured client ID."""

    def _fake_response(self, aud):
        import json

        payload = {"aud": aud, "email": "person@example.com", "sub": "123"}
        body = json.dumps(payload).encode()
        return mock.Mock(ok=True, content=body, json=mock.Mock(return_value=payload))

    @override_settings(GOOGLE_OAUTH2_ALLOWED_AUDIENCES=["web-id", "ios-id", "android-id"])
    def test_native_audiences_are_accepted(self):
        from backend.shared.infrastructure.google_oauth import GoogleOAuthClient

        client = GoogleOAuthClient()
        for aud in ("web-id", "ios-id", "android-id"):
            with mock.patch(
                "backend.shared.infrastructure.google_oauth.requests.get",
                return_value=self._fake_response(aud),
            ):
                result = client.validate_id_token("token")
                self.assertEqual(result["aud"], aud)

    @override_settings(GOOGLE_OAUTH2_ALLOWED_AUDIENCES=["web-id", "ios-id", "android-id"])
    def test_unknown_audience_is_rejected(self):
        from django.core.exceptions import ValidationError

        from backend.shared.infrastructure.google_oauth import GoogleOAuthClient

        client = GoogleOAuthClient()
        with mock.patch(
            "backend.shared.infrastructure.google_oauth.requests.get",
            return_value=self._fake_response("attacker-id"),
        ):
            with self.assertRaises(ValidationError):
                client.validate_id_token("token")

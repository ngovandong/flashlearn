"""Regression tests guarding the DDD refactor against behavior changes.

These cover the error paths that moved from the views into the application
services, ensuring they still return HTTP 400 (not 404 or 500) on bad input.
"""

from rest_framework.test import APITestCase

from backend.models import Deck, User


class DeckUserManagementTest(APITestCase):
    """add_user_to_deck / remove_user_from_deck end-to-end.

    Guards both the unknown-user 400 path and the happy path, which were
    previously unreachable due to the AddUserSerializer source="user.email"
    bug and the remove_user_to_deck serializer_map/permission_map key typo.
    """

    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com", "pw12345!")
        self.member = User.objects.create_user("member@example.com", "pw12345!")
        self.deck = Deck.objects.create(name="My Deck", owner=self.owner)
        self.client.force_authenticate(user=self.owner)

    def test_add_user_unknown_email_returns_400(self):
        url = f"/api/decks/{self.deck.id}/add_user_to_deck/"
        res = self.client.post(url, {"email": "nobody@example.com", "role": "V"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["errors"], "user not found")

    def test_add_user_happy_path(self):
        url = f"/api/decks/{self.deck.id}/add_user_to_deck/"
        res = self.client.post(url, {"email": self.member.email, "role": "V"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn(self.member, self.deck.users.all())

    def test_remove_user_unknown_email_returns_400(self):
        url = f"/api/decks/{self.deck.id}/remove_user_from_deck/"
        res = self.client.post(url, {"email": "nobody@example.com"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["errors"], "user not found")

    def test_remove_user_happy_path(self):
        self.deck.users.add(self.member, through_defaults={"role": "V"})
        url = f"/api/decks/{self.deck.id}/remove_user_from_deck/"
        res = self.client.post(url, {"email": self.member.email}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertNotIn(self.member, self.deck.users.all())


class TermErrorPathTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner2@example.com", "pw12345!")
        self.deck = Deck.objects.create(name="My Deck", owner=self.owner)
        self.client.force_authenticate(user=self.owner)

    def test_create_term_missing_name_returns_400(self):
        res = self.client.post("/api/terms/", {"deck": str(self.deck.id), "description": "no name"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_create_term_blank_name_returns_400(self):
        res = self.client.post("/api/terms/", {"deck": str(self.deck.id), "name": "   "}, format="json")
        self.assertEqual(res.status_code, 400)


class RoleInviteErrorPathTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("invitee@example.com", "pw12345!")
        self.client.force_authenticate(user=self.user)

    def test_invite_without_token_returns_400(self):
        res = self.client.get("/api/roles/invite/")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["errors"], "token is required")

    def test_invite_invalid_token_returns_400(self):
        res = self.client.get("/api/roles/invite/?token=garbage")
        self.assertEqual(res.status_code, 400)

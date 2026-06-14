from django.test import SimpleTestCase

from backend.constants import FULL_ROLE_CLASS
from backend.deck.domain.access import DeckAccessPolicy


class _User:
    def __init__(self, is_superuser=False):
        self.is_superuser = is_superuser


class _Role:
    def __init__(self, user, role):
        self.user = user
        self.role = role


class _Roles:
    def __init__(self, roles):
        self._roles = roles

    def all(self):
        return self._roles


class DeckAccessPolicyTest(SimpleTestCase):
    def setUp(self):
        self.owner = _User()
        self.editor = _User()
        self.viewer = _User()
        self.outsider = _User()
        self.deck = type(
            "Deck",
            (),
            {
                "owner": self.owner,
                "is_public": False,
                "user_roles": _Roles(
                    [
                        _Role(self.editor, FULL_ROLE_CLASS.EDIT),
                        _Role(self.viewer, FULL_ROLE_CLASS.VIEW_ONLY),
                    ]
                ),
            },
        )()

    def test_owner_can_edit_and_view(self):
        self.assertEqual(DeckAccessPolicy.get_user_role(self.deck, self.owner), FULL_ROLE_CLASS.OWNER)
        self.assertTrue(DeckAccessPolicy.can_edit(self.deck, self.owner))
        self.assertTrue(DeckAccessPolicy.can_view(self.deck, self.owner))

    def test_editor_can_edit_not_viewer(self):
        self.assertTrue(DeckAccessPolicy.can_edit(self.deck, self.editor))
        self.assertFalse(DeckAccessPolicy.can_edit(self.deck, self.viewer))

    def test_public_deck_allows_view_for_outsider(self):
        public_deck = type("Deck", (), {"owner": self.owner, "is_public": True, "user_roles": _Roles([])})()
        self.assertTrue(DeckAccessPolicy.can_view(public_deck, self.outsider))
        self.assertFalse(DeckAccessPolicy.can_edit(public_deck, self.outsider))

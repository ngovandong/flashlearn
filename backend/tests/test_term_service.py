import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

from django.test import SimpleTestCase

from backend.shared.application.exceptions import NotFoundError, PermissionDeniedError, ValidationError


class FakeTermRepository:
    def __init__(self):
        self.created = []
        self.bulk_created = []

    def filter_by_deck(self, deck_id):
        return []

    def get_terms_for_deck(self, deck_id, user=None):
        return []

    def get_random_terms(self, deck_id):
        return [
            SimpleNamespace(id="t1", name="alpha", meaning="desc", image="", learning_progress_id=None),
        ]

    def get_revise_terms(self, user, deck_id):
        return [
            SimpleNamespace(id="t1", name="alpha", meaning="desc", image="", learning_progress_id="lp1"),
        ]

    def get_deck_name(self, deck_id):
        return "Test Deck"

    def find_by_name_in_deck(self, deck_id, name):
        return None

    def create(self, deck_id, **fields):
        term = SimpleNamespace(id="new", deck_id=deck_id, **fields)
        self.created.append(term)
        return term

    def bulk_create(self, deck_id, terms_data):
        self.bulk_created.extend(terms_data)

    def update_term(self, term_id, **fields):
        return None

    def browse_in_deck(self, deck_id, query="", ordering="-created_at"):
        self.browsed = (deck_id, query, ordering)
        return []

    def bulk_delete(self, deck_id, term_ids):
        self.deleted = (deck_id, list(term_ids))
        return len(term_ids)


class FakeDeck:
    def __init__(self, deck_id="deck-1", can_edit=True):
        self.id = deck_id
        self.owner = FakeUser()
        self._can_edit = can_edit
        self.user_roles = _EmptyRoles()

    def user_can_edit_deck(self, user):
        return self._can_edit


class _EmptyRoles:
    def all(self):
        return []


class FakeUser:
    id = "user-1"
    is_superuser = False


class TermServiceUnitTest(SimpleTestCase):
    def setUp(self):
        from backend.term.application.services import TermService

        self.TermService = TermService
        self.repo = FakeTermRepository()
        self.service = self.TermService(
            term_repo=self.repo,  # type: ignore[arg-type]
            image_storage=MagicMock(),
            learning_context=MagicMock(),
        )

    def test_get_revise_terms_returns_dto_dicts(self):
        result = self.service.get_revise_terms(FakeUser(), "deck-1")
        self.assertEqual(result["deck_name"], "Test Deck")
        self.assertEqual(result["revise_terms"][0]["name"], "alpha")
        self.assertEqual(result["all_terms"][0]["id"], "t1")

    def test_create_term_requires_deck(self):
        with self.assertRaises(NotFoundError):
            self.service.create_term(None, FakeUser(), {"name": "term"})

    def test_create_term_validates_blank_name(self):
        deck = FakeDeck()
        with self.assertRaises(ValidationError):
            self.service.create_term(deck, deck.owner, {"name": "   "})

    def test_add_terms_delegates_to_repository(self):
        deck = FakeDeck()
        self.service.add_terms(deck, deck.owner, [{"name": "one", "meaning": "", "image": ""}])
        self.assertEqual(len(self.repo.bulk_created), 1)

    def test_browse_terms_trims_query_and_maps_sort(self):
        self.service.browse_terms("deck-1", "  apple ", "az")
        self.assertEqual(self.repo.browsed, ("deck-1", "apple", "name"))

    def test_browse_terms_falls_back_to_newest_for_unknown_sort(self):
        self.service.browse_terms("deck-1", "", "nonsense")
        self.assertEqual(self.repo.browsed, ("deck-1", "", "-created_at"))

    def test_delete_terms_drops_malformed_ids(self):
        deck = FakeDeck()
        valid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
        deleted = self.service.delete_terms(deck, deck.owner, [valid, "not-a-uuid", None])
        self.assertEqual(deleted, 1)
        self.assertEqual(self.repo.deleted, ("deck-1", [uuid.UUID(valid)]))

    def test_delete_terms_requires_at_least_one_id(self):
        deck = FakeDeck()
        with self.assertRaises(ValidationError):
            self.service.delete_terms(deck, deck.owner, [])

    def test_delete_terms_rejects_non_editor(self):
        deck = FakeDeck()
        with self.assertRaises(PermissionDeniedError):
            self.service.delete_terms(deck, FakeUser(), ["3f2504e0-4f89-11d3-9a0c-0305e82c3301"])

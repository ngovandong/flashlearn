from datetime import timedelta

from django.test import TransactionTestCase
from django.utils import timezone

from backend.deck.infrastructure.sql_queries import (
    fetch_member_deck_ids,
    fetch_top_public_deck_ids,
    fetch_user_deck_ids,
)
from backend.learning.infrastructure.sql_queries import fetch_learning_progress_stats
from backend.models import Deck, Term, User, UserLearningProgress
from backend.term.infrastructure.sql_queries import (
    fetch_latest_learned_term_info,
    fetch_revise_terms,
)


class SQLAlchemyTablePropertyTest(TransactionTestCase):
    def test_sa_table_reflects_django_model(self):
        term_table = Term.sa_table
        self.assertEqual(term_table.name, Term._meta.db_table)
        self.assertIs(term_table, Term.table)
        self.assertIn("name", term_table.c)
        self.assertIn("deck_id", term_table.c)


class SQLAlchemyLearningQueryTest(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user("sa@example.com", "pw12345!")
        self.deck = Deck.objects.create(name="SA Deck", owner=self.user)
        self.term_a = Term.objects.create(name="A", deck=self.deck)
        self.term_b = Term.objects.create(name="B", deck=self.deck)
        self.term_c = Term.objects.create(name="C", deck=self.deck)

    def test_learning_progress_stats(self):
        today = timezone.localtime(timezone.now()).date()
        yesterday = timezone.now() - timedelta(days=1)
        progress_a = UserLearningProgress.objects.create(user=self.user, term=self.term_a, score=6)
        progress_b = UserLearningProgress.objects.create(user=self.user, term=self.term_b, score=2)
        progress_c = UserLearningProgress.objects.create(user=self.user, term=self.term_c, score=1)
        UserLearningProgress.objects.filter(pk__in=[progress_a.pk, progress_b.pk]).update(
            last_revised_at=yesterday,
            last_learned_at=yesterday,
        )
        UserLearningProgress.objects.filter(pk=progress_c.pk).update(last_revised_at=timezone.now())

        deck_term, stats = fetch_learning_progress_stats(self.user.id, self.deck.id, today)

        self.assertEqual(deck_term, 3)
        self.assertEqual(stats["completed"], 1)
        self.assertEqual(stats["learning"], 2)
        self.assertEqual(stats["left"], 0)
        self.assertEqual(stats["learned_today"], 1)

    def test_revise_terms_returns_ranked_rows(self):
        old = timezone.now() - timedelta(days=3)
        UserLearningProgress.objects.create(
            user=self.user,
            term=self.term_a,
            score=1,
            last_revised_at=old,
            is_skip=False,
        )
        UserLearningProgress.objects.create(
            user=self.user,
            term=self.term_b,
            score=8,
            last_revised_at=timezone.now(),
            is_skip=False,
        )

        rows = fetch_revise_terms(self.user.id, self.deck.id)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].name, "A")

    def test_latest_learned_term_info(self):
        UserLearningProgress.objects.create(user=self.user, term=self.term_b)
        UserLearningProgress.objects.create(user=self.user, term=self.term_a)

        info = fetch_latest_learned_term_info(self.user.id, self.deck.id, page_size=2)

        self.assertEqual(info["latest_id"], self.term_a.id)
        self.assertGreaterEqual(info["last_learned_index"], 0)
        self.assertGreaterEqual(info["default_page"], 1)


class SQLAlchemyDeckQueryTest(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner-sa@example.com", "pw12345!")
        self.member = User.objects.create_user("member-sa@example.com", "pw12345!")
        self.owned = Deck.objects.create(name="Owned", owner=self.owner)
        self.shared = Deck.objects.create(name="Shared", owner=self.member)
        self.shared.users.add(self.owner, through_defaults={"role": "V"})
        Term.objects.create(name="t1", deck=self.owned)
        Term.objects.create(name="t2", deck=self.shared)
        Term.objects.create(name="t3", deck=self.shared)

    def test_fetch_user_deck_ids(self):
        deck_ids = fetch_user_deck_ids(self.owner.id)
        self.assertEqual(len(deck_ids), 2)

    def test_fetch_member_deck_ids(self):
        deck_ids = fetch_member_deck_ids(self.owner.id)
        self.assertEqual(len(deck_ids), 1)

    def test_fetch_top_public_deck_ids(self):
        public = Deck.objects.create(name="Public", owner=self.member, is_public=True)
        Term.objects.create(name="p1", deck=public)
        Term.objects.create(name="p2", deck=public)

        deck_ids = fetch_top_public_deck_ids(self.owner.id, limit=3)
        self.assertIn(str(public.id).replace("-", ""), deck_ids)

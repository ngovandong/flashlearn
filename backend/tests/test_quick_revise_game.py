from django.test import SimpleTestCase

from backend.learning.application.quick_revise_game import QuickReviseGame


class QuickReviseGameTest(SimpleTestCase):
    def test_calculate_base_time_clamps_at_minimum(self):
        self.assertEqual(QuickReviseGame.calculate_base_time(0), 10)
        self.assertEqual(QuickReviseGame.calculate_base_time(4), 2)
        self.assertEqual(QuickReviseGame.calculate_base_time(10), 2)

    def test_is_correct_ignores_case_and_whitespace(self):
        self.assertTrue(QuickReviseGame.is_correct("  Hello ", "hello"))

    def test_build_question_includes_answer_in_options(self):
        current = {"id": "1", "name": "cat", "description": "A pet", "image": ""}
        all_terms = [
            current,
            {"id": "2", "name": "dog", "description": "Bark", "image": ""},
            {"id": "3", "name": "fish", "description": "Swim", "image": ""},
            {"id": "4", "name": "bird", "description": "Fly", "image": ""},
        ]
        question = QuickReviseGame.build_question(current, all_terms)
        self.assertIn("cat", question["options"])
        self.assertEqual(question["answer"], "cat")
        self.assertEqual(len(question["options"]), 4)

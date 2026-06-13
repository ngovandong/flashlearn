import random


class QuickReviseGame:
    BASE_TIME = 10
    MIN_BASE_TIME = 2
    TIME_DECREMENT = 2

    @staticmethod
    def calculate_base_time(index: int) -> int:
        return max(QuickReviseGame.MIN_BASE_TIME, QuickReviseGame.BASE_TIME - (index * QuickReviseGame.TIME_DECREMENT))

    @staticmethod
    def calculate_time_limit(index: int, leftover: float = 0) -> float:
        return QuickReviseGame.calculate_base_time(index) + leftover

    @staticmethod
    def calculate_leftover(elapsed: float, index: int, leftover: float = 0) -> float:
        base = QuickReviseGame.calculate_base_time(index)
        start_leftover = leftover / 2 if leftover else 0
        return max(0, base + start_leftover - elapsed)

    @staticmethod
    def build_question(current_term: dict, all_terms: list[dict]) -> dict:
        distractors = [t for t in all_terms if t["id"] != current_term["id"]]
        if len(distractors) < 3:
            selected = distractors
        else:
            random.shuffle(distractors)
            selected = distractors[:3]

        options = [current_term["name"]] + [d["name"] for d in selected]
        random.shuffle(options)
        return {
            "progressId": current_term.get("learning_progress_id"),
            "question": current_term["description"],
            "answer": current_term["name"],
            "image": current_term.get("image"),
            "options": options,
            "type": "quiz",
        }

    @staticmethod
    def is_correct(user_answer: str, correct_answer: str) -> bool:
        return user_answer.strip().lower() == correct_answer.lower()

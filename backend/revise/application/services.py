"""Revise session orchestration.

Coordinates candidate gathering (:class:`ReviseRepository`), the spaced-repetition
scheduler (:mod:`backend.revise.domain.scoring`) and per-kind grading
(:mod:`backend.revise.domain.grading` for text, the Speaking Coach's
pronunciation analysis for audio). The DRF viewset stays a thin transport layer.

Two use cases:

* :meth:`build_session` — reseed cards from fresh mistakes, then return an
  interleaved, priority-ordered batch to play.
* :meth:`grade_answer` — grade one answer, update the card's learning stats
  (which reshuffles it for next time), and write vocabulary results back to the
  learning-progress ledger so the two features stay in sync.
"""

from django.utils import timezone

from backend.models import ReviseCard
from backend.revise.domain import grading, scoring
from backend.revise.infrastructure.repository import ReviseRepository
from backend.shared.application.exceptions import NotFoundError, ValidationError

# Default cards per session and how many candidates to gather per kind.
DEFAULT_SESSION_SIZE = 12
_GATHER_PER_KIND = 8
# Pronunciation accuracy (0-100) at/above which a spoken card counts as correct.
_SPEAKING_PASS = 60


class ReviseService:
    def __init__(self, *, repo=ReviseRepository, learning_service=None, speaking_service=None):
        self._repo = repo
        self._learning = learning_service
        self._speaking = speaking_service

    # ── Build a session ─────────────────────────────────────────────────────
    def build_session(self, user, size=DEFAULT_SESSION_SIZE):
        """Reseed cards from recent mistakes, then return an ordered batch.

        Returns ``{"cards": [ReviseCard, ...], "counts": {kind: n}}``. Cards are
        ordered by priority then round-robined across kinds so the session feels
        varied. Empty when the user has nothing to revise yet.
        """
        self._reseed(user)

        now = timezone.now()
        cards = self._repo.active_cards(user)
        for card in cards:
            card.priority = scoring.priority(
                severity=card.severity,
                mistake_count=card.mistake_count,
                correct_streak=card.correct_streak,
                last_wrong_at=card.last_wrong_at,
                now=now,
            )
        cards.sort(key=lambda c: c.priority, reverse=True)
        top = cards[: max(1, size)]
        top = scoring.interleave(top, key=lambda c: c.kind)

        counts = {}
        for card in top:
            counts[card.kind] = counts.get(card.kind, 0) + 1
        return {"cards": top, "counts": counts}

    def _reseed(self, user):
        gatherers = (
            self._repo.vocab_candidates,
            self._repo.grammar_candidates,
            self._repo.listening_candidates,
            self._repo.speaking_candidates,
        )
        for gather in gatherers:
            for cand in gather(user, _GATHER_PER_KIND):
                self._repo.upsert_card(
                    user,
                    cand["kind"],
                    cand["ref"],
                    prompt=cand["prompt"],
                    answer=cand["answer"],
                    payload=cand["payload"],
                    severity=cand["severity"],
                )

    # ── Grade an answer ─────────────────────────────────────────────────────
    def grade_answer(self, user, card_id, *, given=None, audio=None, mime_type=None):
        """Grade one answer, update the card and return the outcome.

        ``given`` is the typed text / chosen option (a string, or a list of
        blanks for grammar); ``audio`` is base64 audio for speaking cards.
        Returns ``{"correct", "answer", "mastered", ...}`` plus kind-specific
        extras (``ratio`` for listening, pronunciation ``score``/``result`` for
        speaking).
        """
        card = self._repo.get_card(user, card_id)
        if card is None:
            raise NotFoundError("Revise card not found.")

        if card.kind == ReviseCard.KIND_SPEAKING:
            outcome = self._grade_speaking(user, card, audio, mime_type)
        elif card.kind == ReviseCard.KIND_GRAMMAR:
            outcome = self._grade_grammar(card, given)
        elif card.kind == ReviseCard.KIND_LISTENING:
            outcome = self._grade_listening(card, given)
        else:
            outcome = self._grade_vocab(user, card, given)

        self._apply_result(card, outcome["correct"])
        self._touch_streak(user, card)

        return {
            "correct": outcome["correct"],
            "answer": card.answer,
            "mastered": card.mastered,
            "mistake_count": card.mistake_count,
            "correct_streak": card.correct_streak,
            **outcome.get("extra", {}),
        }

    # ── Per-kind grading ──────────────────────────────────────────────────
    def _grade_vocab(self, user, card, given):
        correct = grading.grade_choice(given, card.answer)
        term_id = (card.payload or {}).get("term_id")
        if term_id and self._learning is not None:
            self._learning.record_answer(user, term_id, correct)
        return {"correct": correct}

    def _grade_grammar(self, card, given):
        given = given if isinstance(given, list) else [given]
        result = grading.grade_blanks(given, card.answer if isinstance(card.answer, list) else [card.answer])
        return {"correct": result["correct"], "extra": {"blanks": result["blanks"]}}

    def _grade_listening(self, card, given):
        result = grading.grade_sentence(given, card.answer)
        return {"correct": result["correct"], "extra": {"ratio": round(result["ratio"], 2)}}

    def _grade_speaking(self, user, card, audio, mime_type):
        if not audio:
            raise ValidationError("Please record your voice first.")
        if self._speaking is None:
            raise ValidationError("Speaking practice is unavailable.")
        record, result = self._speaking.analyze(
            user,
            target_text=card.answer,
            audio=audio,
            mime_type=mime_type or "audio/webm",
            kind="single",
        )
        accuracy = record.accuracy_score
        return {
            "correct": accuracy >= _SPEAKING_PASS,
            "extra": {"score": accuracy, "result": result},
        }

    # ── Stat updates ──────────────────────────────────────────────────────
    def _apply_result(self, card, correct):
        now = timezone.now()
        card.seen_count += 1
        card.last_seen_at = now
        if correct:
            card.correct_streak += 1
            if scoring.is_mastered(card.correct_streak):
                card.mastered = True
        else:
            card.mistake_count += 1
            card.correct_streak = 0
            card.last_wrong_at = now
        card.priority = scoring.priority(
            severity=card.severity,
            mistake_count=card.mistake_count,
            correct_streak=card.correct_streak,
            last_wrong_at=card.last_wrong_at,
            now=now,
        )
        self._repo.save_card(card)

    def _touch_streak(self, user, card):
        # Vocab writeback already records study activity; count the rest here so
        # a mixed session still feeds the daily learning streak.
        if card.kind != ReviseCard.KIND_VOCAB and self._learning is not None:
            self._learning.record_study_activity(user)

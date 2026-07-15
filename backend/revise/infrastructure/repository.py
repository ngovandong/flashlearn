"""Persistence + cross-feature candidate gathering for the Revise session.

All Django ORM access for the feature lives here. Two responsibilities:

1. **Card persistence** — CRUD for :class:`ReviseCard` (the spaced-repetition
   ledger the session schedules over).
2. **Candidate gathering** — read each feature's existing *wrong* signals
   (low-scoring terms, missed grammar blanks, mistyped dictation lines,
   poorly-pronounced sentences) and shape them into seedable card dicts. This
   mirrors the reminders repository, which likewise reaches across aggregates
   for a read-only, home-page concern.

Each gather method returns a list of plain dicts::

    {"kind", "ref", "prompt", "answer", "payload", "severity"}

which the application service upserts into cards and schedules.
"""

import random

from backend.models import (
    GrammarExercise,
    ListeningExercise,
    ListeningProgress,
    ReviseCard,
    SpeakingAnalysis,
    SpeakingConversation,
    Term,
    UserGrammarExerciseProgress,
    UserLearningProgress,
)

# Below this pronunciation accuracy a practised sentence is worth re-drilling.
_SPEAKING_WEAK_ACCURACY = 70


def _clamp_severity(value):
    return max(1, min(10, int(value)))


class ReviseRepository:
    # ── Card persistence ──────────────────────────────────────────────────
    @staticmethod
    def get_card(user, card_id):
        return ReviseCard.objects.filter(user=user, pk=card_id).first()

    @staticmethod
    def active_cards(user):
        """Every card still in rotation (not yet mastered)."""
        return list(ReviseCard.objects.filter(user=user, mastered=False))

    @staticmethod
    def upsert_card(user, kind, ref, *, prompt, answer, payload, severity):
        """Create a card, or refresh its content while preserving its stats.

        Content (prompt/answer/payload) is re-synced from the source each time so
        edited/re-imported content stays current; the learning counters
        (mistakes, streak) are never reset by a reseed.
        """
        card, created = ReviseCard.objects.get_or_create(
            user=user,
            kind=kind,
            ref=ref,
            defaults={
                "prompt": prompt,
                "answer": answer,
                "payload": payload,
                "severity": _clamp_severity(severity),
            },
        )
        if not created:
            card.prompt = prompt
            card.answer = answer
            card.payload = payload
            card.severity = max(card.severity, _clamp_severity(severity))
            card.save()
        return card

    @staticmethod
    def save_card(card):
        card.save()

    # ── Vocabulary ──────────────────────────────────────────────────────────
    @staticmethod
    def vocab_candidates(user, limit):
        """Low-scoring terms across every deck the user studies, worst first.

        Each becomes a 4-option "what does it mean?" card, with distractor
        meanings drawn from the same deck so the choices stay plausible.
        """
        rows = list(
            UserLearningProgress.objects.filter(user=user, is_skip=False)
            .select_related("term")
            .order_by("score", "-total_revisions")[: limit * 2]
        )
        candidates = []
        for progress in rows:
            term = progress.term
            if term is None or not (term.meaning or "").strip() or not (term.name or "").strip():
                continue
            distractors = ReviseRepository._distractor_meanings(term.deck_id, term.meaning, term.id)
            if len(distractors) < 2:
                continue  # not enough material for a fair multiple choice
            options = [term.meaning] + distractors[:3]
            random.shuffle(options)
            severity = 1 if progress.score >= 0 else 1 + (-progress.score) // 3
            candidates.append(
                {
                    "kind": ReviseCard.KIND_VOCAB,
                    "ref": f"term:{term.id}",
                    "prompt": term.name,
                    "answer": term.meaning,
                    "payload": {
                        "term_id": str(term.id),
                        "pronunciation": term.pronunciation or "",
                        "image": term.image or "",
                        "options": options,
                    },
                    "severity": severity,
                }
            )
            if len(candidates) >= limit:
                break
        return candidates

    @staticmethod
    def _distractor_meanings(deck_id, exclude_meaning, exclude_term_id, n=3):
        pool = list(
            Term.objects.filter(deck_id=deck_id)
            .exclude(id=exclude_term_id)
            .exclude(meaning="")
            .values_list("meaning", flat=True)[:50]
        )
        random.shuffle(pool)
        uniq = []
        seen = {(exclude_meaning or "").strip().lower()}
        for meaning in pool:
            key = (meaning or "").strip().lower()
            if key and key not in seen:
                seen.add(key)
                uniq.append(meaning)
            if len(uniq) >= n:
                break
        return uniq

    # ── Grammar ─────────────────────────────────────────────────────────────
    @staticmethod
    def grammar_candidates(user, limit):
        """Individual blanks the user got wrong in graded grammar exercises."""
        rows = list(UserGrammarExerciseProgress.objects.filter(user=user).order_by("-updated_at")[: limit * 3])
        candidates = []
        for progress in rows:
            results = (progress.last_result or {}).get("results") or []
            wrong_index = next((i for i, r in enumerate(results) if not r.get("correct", True)), None)
            if wrong_index is None:
                continue
            exercise = GrammarExercise.objects.filter(key=progress.exercise_key).select_related("unit").first()
            if exercise is None or wrong_index >= len(exercise.items or []):
                continue
            item = exercise.items[wrong_index]
            answers = item.get("answers") or []
            if not answers:
                continue
            options = (item.get("options") or []) or (exercise.options or [])
            blanks = results[wrong_index].get("blanks") or []
            severity = max(1, sum(1 for ok in blanks if not ok)) if blanks else 1
            candidates.append(
                {
                    "kind": ReviseCard.KIND_GRAMMAR,
                    "ref": f"grammar:{progress.exercise_key}#{wrong_index}",
                    "prompt": item.get("text") or exercise.prompt or "Complete the sentence.",
                    "answer": answers,
                    "payload": {
                        "exercise_kind": exercise.kind,
                        "unit_title": exercise.unit.title if exercise.unit else "",
                        "options": options,
                        "blank_count": len(answers),
                    },
                    "severity": severity,
                }
            )
            if len(candidates) >= limit:
                break
        return candidates

    # ── Listening ─────────────────────────────────────────────────────────
    @staticmethod
    def listening_candidates(user, limit):
        """Dictation sentences the user mistyped, with their audio to replay."""
        rows = list(ListeningProgress.objects.filter(user=user).order_by("-updated_at")[: limit * 3])
        candidates = []
        for progress in rows:
            lines = (progress.last_result or {}).get("lines") or []
            wrong = next(
                (ln for ln in lines if (ln.get("correct") or 0) < (ln.get("total") or 0)),
                None,
            )
            if wrong is None:
                continue
            position = wrong.get("position")
            exercise = ListeningExercise.objects.filter(key=progress.exercise_key).first()
            if exercise is None:
                continue
            sentence = next(
                (s for s in (exercise.sentences or []) if s.get("position") == position),
                None,
            )
            target = wrong.get("target") or (sentence.get("text") if sentence else "")
            audio_url = (sentence or {}).get("audio_url") or (sentence or {}).get("source_audio_url") or ""
            if not target or not audio_url:
                continue
            severity = max(1, (wrong.get("total") or 0) - (wrong.get("correct") or 0))
            candidates.append(
                {
                    "kind": ReviseCard.KIND_LISTENING,
                    "ref": f"listening:{progress.exercise_key}#{position}",
                    "prompt": "Listen and type what you hear.",
                    "answer": target,
                    "payload": {"audio_url": audio_url, "exercise_title": exercise.title},
                    "severity": severity,
                }
            )
            if len(candidates) >= limit:
                break
        return candidates

    # ── Speaking ────────────────────────────────────────────────────────────
    @staticmethod
    def speaking_candidates(user, limit):
        """Sentences to say out loud — weakly-pronounced ones first, then recent
        conversation lines so speaking is always represented."""
        candidates = []
        seen_refs = set()
        analyses = list(
            SpeakingAnalysis.objects.filter(user=user, accuracy_score__lt=_SPEAKING_WEAK_ACCURACY)
            .exclude(target_text="")
            .order_by("-created_at")[: limit * 2]
        )
        for analysis in analyses:
            text = (analysis.target_text or "").strip()
            if not text:
                continue
            ref = f"speaking:{_text_ref(text)}"
            if ref in seen_refs:
                continue
            seen_refs.add(ref)
            severity = _clamp_severity(1 + (_SPEAKING_WEAK_ACCURACY - analysis.accuracy_score) // 10)
            candidates.append(
                {
                    "kind": ReviseCard.KIND_SPEAKING,
                    "ref": ref,
                    "prompt": "Say this sentence out loud.",
                    "answer": text,
                    "payload": {"text": text, "last_accuracy": analysis.accuracy_score},
                    "severity": severity,
                }
            )
            if len(candidates) >= limit:
                return candidates

        # Fallback: seed from the latest conversation's lines (light practice).
        conversation = SpeakingConversation.objects.filter(user=user).order_by("-created_at").first()
        if conversation is not None:
            for line in conversation.lines or []:
                text = (line.get("text") or "").strip()
                if not text:
                    continue
                ref = f"speaking:{_text_ref(text)}"
                if ref in seen_refs:
                    continue
                seen_refs.add(ref)
                candidates.append(
                    {
                        "kind": ReviseCard.KIND_SPEAKING,
                        "ref": ref,
                        "prompt": "Say this sentence out loud.",
                        "answer": text,
                        "payload": {"text": text},
                        "severity": 1,
                    }
                )
                if len(candidates) >= limit:
                    break
        return candidates


def _text_ref(text: str) -> str:
    import hashlib

    return hashlib.sha256((text or "").strip().lower().encode("utf-8")).hexdigest()[:24]

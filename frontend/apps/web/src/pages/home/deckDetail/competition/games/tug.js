import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAnswer,
  buildSynAntQuestions,
  initialComboState,
  simulateBotAnswer,
} from "@flashlearn/core";

const WIN = 1;
const LOSE = 0;
const PULL = 0.13;
const BOT_PULL = 0.09;
const FEEDBACK_MS = 650;

// Synonym Tug-of-War: classify the word, pull the rope to your side.
export default function Tug({ pool, sound, onScoreChange, onGameOver }) {
  const deck = useMemo(() => buildSynAntQuestions(pool.terms), [pool]);
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [rope, setRope] = useState(0.5); // 0 = bot wins, 1 = player wins
  const [picked, setPicked] = useState(null);
  const timerRef = useRef(null);
  const endedRef = useRef(false);

  const question = deck[index % deck.length];

  useEffect(() => onScoreChange(combo.score), [combo.score, onScoreChange]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const settle = (nextRope, correct) => {
    if (endedRef.current) return;
    if (nextRope >= WIN) {
      endedRef.current = true;
      setCombo((c) => {
        onGameOver(c.score + 60);
        return c;
      });
      return;
    }
    if (nextRope <= LOSE) {
      endedRef.current = true;
      setCombo((c) => {
        onGameOver(c.score);
        return c;
      });
      return;
    }
    timerRef.current = setTimeout(() => {
      setIndex((i) => i + 1);
      setPicked(null);
    }, FEEDBACK_MS);
  };

  const answer = (choiceIsSynonym) => {
    if (picked !== null || !question || endedRef.current) return;
    const correct = choiceIsSynonym === question.isSynonym;
    setPicked(choiceIsSynonym ? "syn" : "ant");
    const bot = simulateBotAnswer("medium");
    let delta = correct ? PULL : -PULL;
    if (bot.correct) delta -= BOT_PULL; // bot always pulls toward its side
    if (correct) {
      sound.playCorrect();
      setCombo((c) => applyAnswer(c, true));
    } else {
      sound.playWrong();
      setCombo((c) => applyAnswer(c, false));
    }
    setRope((prev) => {
      const next = Math.min(1, Math.max(0, prev + delta));
      settle(next, correct);
      return next;
    });
  };

  return (
    <div className="cmp-tug">
      <div className="cmp-tug__bar">
        <span className="cmp-tug__side">🤖</span>
        <div className="cmp-tug__rail">
          <span
            className="cmp-tug__knot"
            style={{ left: `${rope * 100}%` }}
          >
            🪢
          </span>
        </div>
        <span className="cmp-tug__side">🧑</span>
      </div>

      {question && (
        <div className="cmp-quiz">
          <div className="cmp-quiz__prompt cmp-tug__prompt">
            <span className="cmp-tug__word">{question.word}</span>
            <span className="cmp-tug__vs">vs</span>
            <span className="cmp-tug__cand">{question.candidate}</span>
          </div>
          <div className="cmp-quiz__options cmp-tug__choices">
            <button
              type="button"
              className={`cmp-option${
                picked === "syn"
                  ? question.isSynonym
                    ? " correct"
                    : " wrong"
                  : ""
              }`}
              onClick={() => answer(true)}
              disabled={picked !== null}
            >
              Synonym
            </button>
            <button
              type="button"
              className={`cmp-option${
                picked === "ant"
                  ? !question.isSynonym
                    ? " correct"
                    : " wrong"
                  : ""
              }`}
              onClick={() => answer(false)}
              disabled={picked !== null}
            >
              Antonym
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

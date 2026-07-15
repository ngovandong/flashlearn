import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAnswer,
  buildImageQuestions,
  initialComboState,
  timeBonus,
} from "@flashlearn/core";

const ROUNDS = 10;
const LIMIT_MS = 6000;
const FEEDBACK_MS = 750;

// Picture Rush: hear the word, tap the matching image before time runs out.
export default function Picture({ pool, sound, onScoreChange, onGameOver }) {
  const deck = useMemo(() => buildImageQuestions(pool.terms), [pool]);
  const total = Math.min(ROUNDS, deck.length) || deck.length;
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [picked, setPicked] = useState(null);
  const [remaining, setRemaining] = useState(LIMIT_MS);
  const startRef = useRef(Date.now());
  const rafRef = useRef(null);
  const feedbackRef = useRef(null);

  const question = deck[index % deck.length];

  useEffect(() => onScoreChange(combo.score), [combo.score, onScoreChange]);

  // Speak the target and run the per-question countdown.
  useEffect(() => {
    if (!question) return undefined;
    setPicked(null);
    setRemaining(LIMIT_MS);
    startRef.current = Date.now();
    sound.say(question.prompt);
    const tick = () => {
      const left = Math.max(0, LIMIT_MS - (Date.now() - startRef.current));
      setRemaining(left);
      if (left <= 0) resolve(null);
      else rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(feedbackRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, question]);

  const resolve = (option) => {
    if (picked) return;
    cancelAnimationFrame(rafRef.current);
    const correct = option && option.name === question.answer;
    setPicked(option ? option.name : "__timeout__");
    if (correct) {
      sound.playCorrect();
      setCombo((c) => {
        const next = applyAnswer(c, true);
        return {
          ...next,
          score: next.score + timeBonus(remaining, LIMIT_MS),
        };
      });
    } else {
      sound.playWrong();
      setCombo((c) => applyAnswer(c, false));
    }
    feedbackRef.current = setTimeout(() => {
      const next = index + 1;
      if (next >= total) {
        setCombo((c) => {
          onGameOver(c.score);
          return c;
        });
      } else {
        setIndex(next);
      }
    }, FEEDBACK_MS);
  };

  const pct = (remaining / LIMIT_MS) * 100;

  return (
    <div className="cmp-picture">
      <div className="cmp-picture__prompt">
        <span className="cmp-picture__count">
          {Math.min(index + 1, total)} / {total}
        </span>
        <span className="cmp-picture__word">{question?.prompt}</span>
        {question?.hint && (
          <span className="cmp-picture__hint">{question.hint}</span>
        )}
      </div>
      <div className="cmp-picture__timer">
        <span style={{ width: `${pct}%` }} data-low={pct < 30} />
      </div>
      {question && (
        <div className="cmp-picture__grid">
          {question.options.map((option) => {
            let cls = "";
            if (picked) {
              if (option.name === question.answer) cls = " correct";
              else if (option.name === picked) cls = " wrong";
            }
            return (
              <button
                key={option.name}
                type="button"
                className={`cmp-picture__tile${cls}`}
                onClick={() => resolve(option)}
                disabled={Boolean(picked)}
              >
                <img src={option.image} alt="" loading="lazy" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAnswer,
  buildSentenceQuestions,
  checkAnswer,
  initialComboState,
} from "@flashlearn/core";

const ROUNDS = 8;
const FEEDBACK_MS = 1100;

// Sentence Sniper: type the missing word to complete the example sentence.
export default function Sentence({ pool, sound, onScoreChange, onGameOver }) {
  const deck = useMemo(() => buildSentenceQuestions(pool.terms), [pool]);
  const total = Math.min(ROUNDS, deck.length) || deck.length;
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState(null); // null | correct | wrong
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const question = deck[index % deck.length];
  const [before, after] = (question?.sentence ?? "").split("_____");

  useEffect(() => onScoreChange(combo.score), [combo.score, onScoreChange]);
  useEffect(() => {
    setValue("");
    setStatus(null);
    inputRef.current?.focus();
    return () => clearTimeout(timerRef.current);
  }, [index]);

  const submit = (e) => {
    e.preventDefault();
    if (status || !question || !value.trim()) return;
    const result = checkAnswer(value, question.answer);
    if (result.isCorrect) {
      sound.playCorrect();
      sound.say(question.answer);
      setStatus("correct");
      setCombo((c) => applyAnswer(c, true));
    } else {
      sound.playWrong();
      setStatus("wrong");
      setCombo((c) => applyAnswer(c, false));
    }
    timerRef.current = setTimeout(() => {
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

  return (
    <div className="cmp-sentence">
      <div className="cmp-sentence__count">
        {Math.min(index + 1, total)} / {total}
      </div>
      {question && (
        <>
          <p className="cmp-sentence__text">
            {before}
            <span className={`cmp-sentence__blank ${status ?? ""}`}>
              {status ? question.answer : "_____"}
            </span>
            {after}
          </p>
          {question.hint && (
            <p className="cmp-sentence__hint">Hint: {question.hint}</p>
          )}
          <form className="cmp-sentence__form" onSubmit={submit}>
            <input
              ref={inputRef}
              className={`cmp-sentence__input ${status ?? ""}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type the missing word"
              disabled={Boolean(status)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="cmp-btn"
              disabled={Boolean(status)}
            >
              Fire
            </button>
          </form>
          {status === "wrong" && (
            <p className="cmp-sentence__answer">
              Answer: <strong>{question.answer}</strong>
            </p>
          )}
        </>
      )}
    </div>
  );
}

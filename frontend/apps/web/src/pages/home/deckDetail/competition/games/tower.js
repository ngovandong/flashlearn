import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildMcqQuestions, ghostScoreAt } from "@flashlearn/core";

const DURATION_MS = 60_000;
const FEEDBACK_MS = 350;

// Word Tower: stack a block per correct answer in 60s and out-climb your ghost.
export default function Tower({ pool, best, sound, onScoreChange, onGameOver }) {
  const deck = useMemo(() => buildMcqQuestions(pool.terms), [pool]);
  const [index, setIndex] = useState(0);
  const [blocks, setBlocks] = useState(0);
  const [picked, setPicked] = useState(null);
  const [remaining, setRemaining] = useState(DURATION_MS);
  const [ghost, setGhost] = useState(0);
  const bestRef = useRef(best ?? 0);
  const startRef = useRef(Date.now());
  const feedbackRef = useRef(null);

  const question = deck[index % deck.length];

  useEffect(() => onScoreChange(blocks), [blocks, onScoreChange]);

  // Countdown + ghost pace driven by one interval.
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, DURATION_MS - elapsed);
      setRemaining(left);
      setGhost(ghostScoreAt(elapsed, DURATION_MS, bestRef.current));
      if (left <= 0) {
        clearInterval(id);
        setBlocks((b) => {
          onGameOver(b);
          return b;
        });
      }
    }, 100);
    return () => {
      clearInterval(id);
      clearTimeout(feedbackRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (option) => {
    if (picked || !question || remaining <= 0) return;
    const correct = option === question.answer;
    setPicked(option);
    if (correct) {
      sound.playCorrect();
      setBlocks((b) => b + 1);
    } else {
      sound.playWrong();
    }
    feedbackRef.current = setTimeout(() => {
      setIndex((i) => i + 1);
      setPicked(null);
    }, FEEDBACK_MS);
  };

  const seconds = Math.ceil(remaining / 1000);
  const ghostBlocks = Math.floor(ghost);

  return (
    <div className="cmp-tower">
      <div className="cmp-tower__timer" data-low={seconds <= 10}>
        {seconds}s
      </div>
      <div className="cmp-tower__arena">
        <div className="cmp-tower__stack">
          {Array.from({ length: blocks }).map((_, i) => (
            <span className="cmp-tower__block" key={i} />
          ))}
          {ghostBlocks > 0 && (
            <span
              className="cmp-tower__ghost"
              style={{ bottom: `calc(${ghostBlocks} * (var(--block) + 4px))` }}
            >
              ghost
            </span>
          )}
        </div>
      </div>

      {question && (
        <div className="cmp-quiz">
          <div className="cmp-quiz__prompt">{question.prompt}</div>
          <div className="cmp-quiz__options">
            {question.options.map((option) => {
              let cls = "";
              if (picked) {
                if (option === question.answer) cls = " correct";
                else if (option === picked) cls = " wrong";
              }
              return (
                <button
                  key={option}
                  type="button"
                  className={`cmp-option${cls}`}
                  onClick={() => answer(option)}
                  disabled={Boolean(picked)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

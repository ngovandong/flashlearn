import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAnswer,
  buildMcqQuestions,
  initialComboState,
  simulateBotAnswer,
} from "@flashlearn/core";

const TOTAL = 12;
const BOTS = [
  { name: "Turbo", difficulty: "hard", emoji: "🏎️" },
  { name: "Zoom", difficulty: "medium", emoji: "🚙" },
  { name: "Putt", difficulty: "easy", emoji: "🚗" },
];
const FEEDBACK_MS = 750;

// Vocab Grand Prix: answer meaning -> name to fuel your car past the bots.
export default function Race({ pool, sound, onScoreChange, onGameOver }) {
  const questions = useMemo(
    () => buildMcqQuestions(pool.terms, TOTAL),
    [pool]
  );
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [player, setPlayer] = useState(0);
  const [bots, setBots] = useState(() => BOTS.map(() => 0));
  const [picked, setPicked] = useState(null);
  const [boost, setBoost] = useState(false);
  const timerRef = useRef(null);

  const question = questions[index];
  const total = questions.length || TOTAL;

  useEffect(() => onScoreChange(combo.score), [combo.score, onScoreChange]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const answer = (option) => {
    if (picked || !question) return;
    const correct = option === question.answer;
    setPicked(option);
    if (correct) {
      sound.playCorrect();
      sound.say(question.answer);
      setCombo((c) => applyAnswer(c, true));
      setPlayer((p) => p + 1);
      setBoost(true);
      setTimeout(() => setBoost(false), 500);
    } else {
      sound.playWrong();
      setCombo((c) => applyAnswer(c, false));
    }
    // Bots race on every question, regardless of the player's answer.
    setBots((prev) =>
      prev.map((pos, i) =>
        simulateBotAnswer(BOTS[i].difficulty).correct ? pos + 1 : pos
      )
    );

    timerRef.current = setTimeout(() => {
      const next = index + 1;
      if (next >= total) finish();
      else {
        setIndex(next);
        setPicked(null);
      }
    }, FEEDBACK_MS);
  };

  const finish = () => {
    setBots((finalBots) => {
      const ahead = finalBots.filter((b) => b > player).length;
      const placement = ahead + 1; // 1 = first place
      const bonus = Math.max(0, (BOTS.length + 1 - placement) * 25);
      setCombo((c) => {
        onGameOver(c.score + bonus);
        return c;
      });
      return finalBots;
    });
  };

  const lanes = [
    { name: "You", emoji: "🏁", pos: player, me: true },
    ...BOTS.map((b, i) => ({ name: b.name, emoji: b.emoji, pos: bots[i] })),
  ];

  return (
    <div className="cmp-race">
      <div className="cmp-race__track">
        {lanes.map((lane, i) => (
          <div className={`cmp-lane${lane.me ? " me" : ""}`} key={i}>
            <span className="cmp-lane__label">{lane.name}</span>
            <div className="cmp-lane__road">
              <span
                className={`cmp-lane__car${lane.me && boost ? " boost" : ""}`}
                style={{ left: `${(lane.pos / total) * 100}%` }}
              >
                {lane.me && boost && <span className="cmp-lane__nitro" />}
                {lane.emoji}
              </span>
            </div>
          </div>
        ))}
        <span className="cmp-race__flag">🏁</span>
      </div>

      {question && (
        <div className="cmp-quiz">
          <div className="cmp-quiz__prompt">
            <span className="cmp-quiz__count">
              {index + 1} / {total}
            </span>
            {question.prompt}
          </div>
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

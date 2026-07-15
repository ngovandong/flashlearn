import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAnswer,
  buildMcqQuestions,
  initialComboState,
  simulateBotAnswer,
} from "@flashlearn/core";

const TOTAL = 12;
const FEEDBACK_MS = 900;

// Bot Buzzer: answer before the bot buzzes in to steal the point.
export default function Buzzer({ pool, sound, onScoreChange, onGameOver }) {
  const questions = useMemo(() => buildMcqQuestions(pool.terms, TOTAL), [pool]);
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [botScore, setBotScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [botBuzzed, setBotBuzzed] = useState(false);
  const buzzTimer = useRef(null);
  const nextTimer = useRef(null);

  const question = questions[index];
  const total = questions.length || TOTAL;

  useEffect(() => onScoreChange(combo.score), [combo.score, onScoreChange]);

  // Schedule the bot's buzz for the current question.
  useEffect(() => {
    if (!question) return undefined;
    setPicked(null);
    setBotBuzzed(false);
    const decision = simulateBotAnswer("medium");
    buzzTimer.current = setTimeout(() => {
      setBotBuzzed(true);
      if (decision.correct) {
        sound.playWrong();
        setBotScore((s) => s + 1);
        setCombo((c) => applyAnswer(c, false)); // player missed the buzz
        advance();
      }
    }, decision.delayMs);
    return () => {
      clearTimeout(buzzTimer.current);
      clearTimeout(nextTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, question]);

  const advance = () => {
    nextTimer.current = setTimeout(() => {
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

  const answer = (option) => {
    if (picked || botBuzzed || !question) return;
    clearTimeout(buzzTimer.current);
    const correct = option === question.answer;
    setPicked(option);
    if (correct) {
      sound.playCorrect();
      sound.say(question.answer);
      setCombo((c) => applyAnswer(c, true));
    } else {
      sound.playWrong();
      setCombo((c) => applyAnswer(c, false));
    }
    advance();
  };

  return (
    <div className="cmp-buzzer">
      <div className="cmp-buzzer__scores">
        <span className="cmp-buzzer__you">You {combo.score}</span>
        <span className={`cmp-buzzer__bot${botBuzzed ? " active" : ""}`}>
          🤖 {botScore}
        </span>
      </div>

      {question && (
        <div className="cmp-quiz">
          <div className="cmp-quiz__prompt">
            <span className="cmp-quiz__count">
              {index + 1} / {total}
            </span>
            {question.prompt}
          </div>
          {botBuzzed && !picked && (
            <div className="cmp-buzzer__flash">Bot buzzed first!</div>
          )}
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
                  disabled={Boolean(picked) || botBuzzed}
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

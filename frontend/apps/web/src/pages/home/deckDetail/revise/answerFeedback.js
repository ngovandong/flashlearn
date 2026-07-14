import React, { useMemo } from "react";
import { diffAnswer } from "@utils/answerCheck";

/**
 * Renders the post-answer feedback for the quiz/fill modes.
 *
 * - "correct"  : simple confirmation.
 * - "accepted" : confirmation that notes the exact expected answer (we accepted
 *                a minor typo / variant).
 * - "incorrect": shows a character-level diff highlighting exactly what the user
 *                got wrong and what the correct answer was.
 */
const DiffText = ({ segments, missingClass }) =>
  segments.map((seg, index) => (
    <span key={index} className={seg.match ? "diff-ok" : missingClass}>
      {seg.text}
    </span>
  ));

const AnswerFeedback = ({ status, userAnswer = "", correctAnswer = "" }) => {
  const diff = useMemo(
    () => diffAnswer(userAnswer, correctAnswer),
    [userAnswer, correctAnswer]
  );

  if (status === "correct") {
    return <div className="correct-feedback">Correct!</div>;
  }

  if (status === "accepted") {
    return (
      <div className="correct-feedback">
        Correct!{" "}
        <span className="accepted-note">(exact answer: {correctAnswer})</span>
      </div>
    );
  }

  return (
    <div className="incorrect-feedback">
      {userAnswer ? (
        <div className="feedback-line">
          <span className="feedback-label">Your answer</span>
          <span className="answer-diff">
            <DiffText segments={diff.user} missingClass="diff-wrong" />
          </span>
        </div>
      ) : (
        <div className="feedback-line">
          <span className="feedback-label">Your answer</span>
          <span className="answer-diff diff-blank">(no answer)</span>
        </div>
      )}
      <div className="feedback-line">
        <span className="feedback-label">Correct answer</span>
        <span className="answer-diff">
          <DiffText segments={diff.correct} missingClass="diff-missing" />
        </span>
      </div>
    </div>
  );
};

export default AnswerFeedback;

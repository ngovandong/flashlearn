import React, { useLayoutEffect, useState } from "react";
import QuestionHeader from "./questionHeader";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import { COLORS } from "@constants/colors";
const initialState = {
  isCorrect: false,
  isAnswered: false,
  answer: "",
};
const Fill = ({
  question,
  speakTerm,
  playCorrectSound,
  playIncorrectSound,
  showNext,
}) => {
  const [currentState, setCurrentState] = useState(initialState);
  const handleAnswer = () => {
    showNext();
    const isCorrect =
      currentState.answer.toLowerCase() === question.answer.toLowerCase();
    setCurrentState((pre) => ({
      ...pre,
      isCorrect: isCorrect,
      isAnswered: true,
    }));
    if (isCorrect) {
      playCorrectSound();
    } else {
      playIncorrectSound();
    }
  };
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleAnswer();
    }
  };

  const handleShowAnswer = () => {
    setCurrentState((pre) => ({ ...pre, isAnswered: true }));
  };

  const handleChange = (e) => {
    if (!currentState.isAnswered) {
      setCurrentState((pre) => ({ ...pre, answer: e.target.value }));
    }
  };
  useLayoutEffect(() => {
    setCurrentState(initialState);
  }, [question]);
  return (
    <div className="quiz-container">
      <QuestionHeader
        image={question.image}
        question={question.question}
        speakTerm={speakTerm}
      />
      <div className="answer-container">
        <div className="input-container">
          <label htmlFor="answer-input">Your answer</label>
          <div className="input-group">
            <input
              id="answer-input"
              autoComplete="off"
              className={`answer-input${
                currentState.isAnswered && currentState.isCorrect
                  ? " correct"
                  : ""
              }${
                currentState.isAnswered && !currentState.isCorrect
                  ? " incorrect"
                  : ""
              }`}
              disabled={currentState.isAnswered}
              type="text"
              value={currentState.answer}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
            />
            {currentState.isAnswered && currentState.isCorrect && (
              <CheckIcon
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "10px",
                  color: COLORS.LIGHT_BLUE,
                }}
              />
            )}
            {currentState.isAnswered && !currentState.isCorrect && (
              <CloseIcon
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "10px",
                  color: COLORS.ERROR_RED,
                }}
              />
            )}
          </div>
        </div>
        <div className="button-group">
          <div
            className={`btn-answer${
              currentState.isAnswered ? " disabled" : ""
            }`}
            onClick={handleAnswer}
          >
            Answer
          </div>
          <div
            className={`btn-show-answer${
              currentState.isAnswered ? " disabled" : ""
            }`}
            onClick={handleShowAnswer}
          >
            I Don't Know
          </div>
        </div>
      </div>
      {currentState.isAnswered && (
        <div className="feedback">
          {currentState.isCorrect ? (
            <div className="correct-feedback">Correct!</div>
          ) : (
            <div className="incorrect-feedback">
              Incorrect. The correct answer is {question.answer}.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Fill;

import React, { useEffect, useLayoutEffect, useState } from "react";
import QuestionHeader from "./questionHeader";
import AnswerFeedback from "./answerFeedback";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import { COLORS } from "@constants/colors";
import { checkAnswer } from "@utils/answerCheck";
const initialState = {
  isCorrect: false,
  isAnswered: false,
  status: null,
  answer: "",
};
const Fill = ({
  question,
  speakTerm,
  handleCorrect,
  handleIncorrect,
  showNext,
  setIsLoading,
}) => {
  const [currentState, setCurrentState] = useState(initialState);
  const handleAnswer = () => {
    const result = checkAnswer(currentState.answer, question.answer);
    setCurrentState((pre) => ({
      ...pre,
      isCorrect: result.isCorrect,
      status: result.status,
      isAnswered: true,
    }));
    if (result.isCorrect) {
      handleCorrect();
    } else {
      handleIncorrect();
    }
    showNext();
  };
  const handleKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      handleAnswer();
    }
  };

  const handleShowAnswer = () => {
    setCurrentState((pre) => ({
      ...pre,
      isAnswered: true,
      isCorrect: false,
      status: "incorrect",
    }));
    showNext();
  };

  const handleChange = (e) => {
    if (!currentState.isAnswered) {
      setCurrentState((pre) => ({ ...pre, answer: e.target.value }));
    }
  };
  useLayoutEffect(() => {
    setCurrentState(initialState);
  }, [question]);

  useEffect(() => {
    if (currentState.answer === "")
      document.getElementById("answer-input").focus();
  }, [currentState.answer]);

  return (
    <div className="quiz-container" data-tour="revise-quiz">
      <QuestionHeader
        name={question.answer}
        id={question.progressId}
        image={question.image}
        question={question.question}
        speakTerm={speakTerm}
        setIsLoading={setIsLoading}
      />
      <div className="answer-container">
        <div className="input-container">
          <label htmlFor="answer-input">Your answer</label>
          <div className="input-group">
            <input
              id="answer-input"
              autoComplete="off"
              autoFocus
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
                  right: "20px",
                  top: "10px",
                  color: COLORS.LIGHT_BLUE,
                }}
              />
            )}
            {currentState.isAnswered && !currentState.isCorrect && (
              <CloseIcon
                style={{
                  position: "absolute",
                  right: "20px",
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
              currentState.isAnswered || currentState.answer === ""
                ? " disabled"
                : ""
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
          <AnswerFeedback
            status={currentState.status}
            userAnswer={currentState.answer}
            correctAnswer={question.answer}
          />
        </div>
      )}
    </div>
  );
};

export default Fill;

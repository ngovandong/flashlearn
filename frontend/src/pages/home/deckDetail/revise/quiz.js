import React, { useEffect, useLayoutEffect, useState } from "react";
import Answer from "./answer";

const Quiz = ({ question }) => {
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const correctSound = new Audio(`${process.env.PUBLIC_URL}/sound/true.mp3`);
  const incorrectSound = new Audio(`${process.env.PUBLIC_URL}/sound/false.mp3`);

  const playCorrectSound = () => {
    correctSound.play();
  };
  const playIncorrectSound = () => {
    incorrectSound.play();
  };

  const isAnswered = selectedAnswer !== "";
  const handleAnswerClick = (letter) => {
    if (!isAnswered) {
      setSelectedAnswer(letter);
      if (letter === question.answer) {
        playCorrectSound();
      } else {
        playIncorrectSound();
      }
    }
  };

  const isCorrect = question.answer === selectedAnswer;
  const correctAnswer = question.answer;

  useLayoutEffect(() => {
    setSelectedAnswer("");
  }, [question]);

  return (
    <div className="quiz-container">
      <div className="question-container">
        <div className="question">{question.question}</div>
        {question.img && <img src={question.img} alt="" />}
      </div>
      <div className="answer-container">
        {question.options.map((option, index) => (
          <Answer
            key={index}
            letter={String.fromCharCode(65 + index)}
            option={option}
            handleAnswerClick={handleAnswerClick}
            selectedAnswer={selectedAnswer}
            correctAnswer={correctAnswer}
          />
        ))}
      </div>
      {isAnswered && (
        <div className="feedback">
          {isCorrect ? (
            <div className="correct-feedback">Correct!</div>
          ) : (
            <div className="incorrect-feedback">
              Incorrect. The correct answer is{" "}
              {question.options[correctAnswer.charCodeAt(0) - 65]}.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Quiz;

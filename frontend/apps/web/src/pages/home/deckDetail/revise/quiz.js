import React, { useLayoutEffect, useState } from "react";
import Answer from "./answer";
import QuestionHeader from "./questionHeader";
import AnswerFeedback from "./answerFeedback";

const Quiz = ({
  question,
  speakTerm,
  handleCorrect,
  handleIncorrect,
  showNext,
  setIsLoading,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState("");

  const isAnswered = selectedAnswer !== "";
  const handleAnswerClick = (choosed) => {
    showNext();
    if (!isAnswered) {
      setSelectedAnswer(choosed);
      if (choosed === question.answer) {
        handleCorrect();
      } else {
        handleIncorrect();
      }
    }
  };

  const isCorrect = question.answer === selectedAnswer;
  const correctAnswer = question.answer;

  useLayoutEffect(() => {
    setSelectedAnswer("");
  }, [question]);
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
      <div className="choice-container">
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
          <AnswerFeedback
            status={isCorrect ? "correct" : "incorrect"}
            userAnswer={selectedAnswer}
            correctAnswer={correctAnswer}
          />
        </div>
      )}
    </div>
  );
};

export default Quiz;

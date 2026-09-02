import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useRef, useState } from "react";
import { learningService } from "@api-services/learningService";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Confetti from "react-confetti";
import { LocalLoadingWrapper } from "@components/loading";
import Quiz from "./quiz";
import Fill from "./fill";
import { QUESTION_TYPES } from "@constants/questionTypes";
import { speak } from "@api-services/voiceService";
import { useReviseTerms } from "@hooks/useReviseTerms";
import { useStudySounds } from "@hooks/useStudySounds";
import { useSwipeGesture } from "@hooks/useSwipeGesture";

function Revise() {
  const timeoutRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [currentState, setCurrentState] = useState({
    index: 0,
    showNext: false,
  });
  const navigate = useNavigate();
  const { deckID } = useParams();
  const {
    data,
    isLoading: queryLoading,
    isFetching,
    error,
    refetch,
  } = useReviseTerms(deckID);
  const sounds = useStudySounds();

  const deckName = data?.deckName ?? "";
  const terms = data?.questions;

  let currentQuestion = null;
  let length = 0;
  if (terms) {
    currentQuestion = terms[currentState.index];
    length = terms.length;
  }
  const isLastQuestion = currentState.index === length - 1;

  useEffect(() => {
    if (error) {
      toast.error(error.message);
    }
  }, [error]);

  useEffect(() => {
    if (data && data.reviseCount === 0) {
      toast.info("Nothing to revise yet");
      navigate(`/deck/${deckID}`);
    }
  }, [data, deckID, navigate]);

  const resetSession = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowConfetti(false);
    setCurrentState({ index: 0, showNext: false });
    // Remounts Quiz/Fill/QuestionHeader so their answer state starts empty.
    setSessionKey((pre) => pre + 1);
  };

  const handleNextQuestionClick = () => {
    if (currentState.index < length - 1) {
      setCurrentState((pre) => ({ index: pre.index + 1, showNext: false }));
    } else {
      resetSession();
      navigate(-1);
    }
  };

  const handleNewSessionClick = () => {
    resetSession();
    refetch();
  };

  const showNext = () => {
    if (currentState.index === length - 1) {
      sounds.finish.play();
      setShowConfetti(true);
    }
    setCurrentState((pre) => ({ ...pre, showNext: true }));
  };

  const { handleTouchStart, handleTouchEnd } = useSwipeGesture({
    threshold: 40,
    onSwipeLeft: () => {
      if (currentState.showNext) {
        handleNextQuestionClick();
      }
    },
  });

  const speakTermWhenAnswer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    speak(currentQuestion.answer);
  };

  const handleCorrect = async () => {
    speakTermWhenAnswer();
    sounds.correct.play();
    try {
      await learningService.correct(currentQuestion.progressId);
    } catch {
      toast.error("Failed to record correct answer");
    }
  };

  const handleIncorrect = async () => {
    speakTermWhenAnswer();
    sounds.incorrect.play();
    try {
      await learningService.incorrect(currentQuestion.progressId);
    } catch {
      toast.error("Failed to record incorrect answer");
    }
  };

  const speakTerm = async () => {
    speak(currentQuestion.answer);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowRight" || event.key === "Enter") {
      handleNextQuestionClick();
    }
  };

  useEffect(() => {
    if (currentState.showNext) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentState.showNext]);

  useEffect(() => {
    if (currentQuestion) {
      const timeout = currentQuestion.type === QUESTION_TYPES.FILL ? 12000 : 5000;
      timeoutRef.current = setTimeout(() => {
        speak(currentQuestion.answer);
      }, timeout);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentQuestion]);

  const isFetchingQuestions = queryLoading || isFetching;
  const loading = isFetchingQuestions || isLoading;

  return terms && !isFetchingQuestions ? (
    <div
      className="learn-wrapper"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {showConfetti && (
        <Confetti
          gravity={0.2}
          width={window.innerWidth}
          height={window.innerHeight}
        />
      )}
      <div className="learn-header">
        <div className="left-header"></div>
        <div className="center-header">
          <div>{deckName}</div>
          <span>{`${currentState.index + 1}/${terms.length}`}</span>
        </div>
        <div className="right-header">
          <div className="close-btn">
            <IconButton component="label" onClick={() => navigate(-1)}>
              <CloseIcon />
            </IconButton>
          </div>
        </div>
      </div>
      <div className="learn-body">
        <div className="learn-container">
          {currentQuestion.type === QUESTION_TYPES.QUIZ ? (
            <Quiz
              key={`${sessionKey}-${currentState.index}`}
              question={currentQuestion}
              speakTerm={speakTerm}
              handleCorrect={handleCorrect}
              handleIncorrect={handleIncorrect}
              showNext={showNext}
              setIsLoading={setIsLoading}
            />
          ) : (
            <Fill
              key={`${sessionKey}-${currentState.index}`}
              question={currentQuestion}
              speakTerm={speakTerm}
              handleCorrect={handleCorrect}
              handleIncorrect={handleIncorrect}
              showNext={showNext}
              setIsLoading={setIsLoading}
            />
          )}
          {currentState.showNext && (
            <div className="next-button-group">
              <button className="next-button" onClick={handleNextQuestionClick}>
                {isLastQuestion ? "Finish" : "Next question"}
              </button>
              {isLastQuestion && (
                <button
                  className="next-button next-button--secondary"
                  onClick={handleNewSessionClick}
                >
                  Next
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <LocalLoadingWrapper open={loading} />
  );
}

export default Revise;

import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useState } from "react";
import { learningService } from "@api-services/learningService";
import { useNavigate, useParams } from "react-router-dom";
import { getFirstError } from "@utils/errorHandler";
import { toast } from "react-toastify";
import Confetti from "react-confetti";
import { LocalLoadingWrapper } from "@components/loading";
import { speak } from "@api-services/voiceService";
import { deckService } from "@api-services/deckService";
import Quiz from "./quiz";
import { generateQuestions } from "./generateQuestion";
import Fill from "./fill";
import { QUESTION_TYPES } from "@constants/questionTypes";

function Revise() {
  const [deck, setDeck] = useState();
  const [isLoading, setIsLoading] = useState(true);
  const [terms, setTerms] = useState();
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentState, setCurrentState] = useState({
    index: 0,
    showNext: false,
  });
  let currentQuestion = null;
  let length = 0;
  if (terms) {
    currentQuestion = terms[currentState.index];
    length = terms.length;
  }

  const correctSound = new Audio(`${process.env.PUBLIC_URL}/sound/true.mp3`);
  const incorrectSound = new Audio(`${process.env.PUBLIC_URL}/sound/false.mp3`);
  const finishSound = new Audio(
    `${process.env.PUBLIC_URL}/sound/congratulation.mp3`
  );
  const handleNextQuestionClick = () => {
    if (currentState.index < length - 1) {
      setCurrentState((pre) => ({ index: pre.index + 1, showNext: false }));
    } else {
      navigate(-1);
    }
  };

  const showNext = () => {
    if (currentState.index === length - 1) {
      finishSound.play();
      setShowConfetti(true);
    }
    setCurrentState((pre) => ({ ...pre, showNext: true }));
  };

  const navigate = useNavigate();
  const { deckID } = useParams();

  const playCorrectSound = () => {
    correctSound.play();
  };
  const playIncorrectSound = () => {
    incorrectSound.play();
  };

  const handleCorrect = async () => {
    playCorrectSound();
    await learningService.correct(currentQuestion.progressId);
  };
  const handleIncorrect = async () => {
    playIncorrectSound();
    await learningService.incorrect(currentQuestion.progressId);
  };

  const speakTerm = async () => {
    speak(currentQuestion.answer);
  };

  const fetchWords = async () => {
    try {
      const res = await learningService.getReviseTerms(deckID);
      if (!res.error) {
        const { revise_terms, all_terms } = res.data;
        if (revise_terms.length === 0) {
          toast.info("Has nothing to revise");
          navigate(`/deck/${deckID}`);
        }
        const questions = generateQuestions(revise_terms, all_terms);
        setTerms(questions);
      } else {
        const errorMessage = getFirstError(res.error);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchDeck = async () => {
    try {
      setIsLoading(true);
      const res = await deckService.retrieve(deckID);
      if (!res.error) {
        setDeck(res.data);
      } else {
        const errorMessage = getFirstError(res.error);
        if (
          errorMessage === "You do not have permission to perform this action."
        ) {
          navigate("/denied");
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, []);

  useEffect(() => {
    if (deckID) {
      fetchDeck();
    }
  }, [deckID]);

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
  }, [currentState.showNext]);

  return deck && terms ? (
    <div className="learn-wrapper">
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
          <div>{deck.name}</div>
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
              question={currentQuestion}
              speakTerm={speakTerm}
              handleCorrect={handleCorrect}
              handleIncorrect={handleIncorrect}
              showNext={showNext}
              setIsLoading={setIsLoading}
            />
          ) : (
            <Fill
              question={currentQuestion}
              speakTerm={speakTerm}
              handleCorrect={handleCorrect}
              handleIncorrect={handleIncorrect}
              showNext={showNext}
              setIsLoading={setIsLoading}
            />
          )}
          <button
            className={`next-button${
              currentState.showNext ? "" : " display-none"
            }`}
            onClick={handleNextQuestionClick}
          >
            {currentState.index === length - 1 ? "Finish" : "Next Question"}
          </button>
        </div>
      </div>
    </div>
  ) : (
    <LocalLoadingWrapper open={isLoading} />
  );
}

export default Revise;

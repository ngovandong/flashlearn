import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useState } from "react";
import { learningService } from "@api-services/learningService";
import { useNavigate, useParams } from "react-router-dom";
import { getFirstError } from "@utils/errorHandler";
import { toast } from "react-toastify";
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

  const [currentState, setCurrentState] = useState({
    index: 0,
    showNext: false,
  });
  let currentQuestion = null;
  if (terms) {
    currentQuestion = terms[currentState.index];
  }

  const handleNextQuestionClick = () => {
    setCurrentState((pre) => ({ index: pre.index + 1, showNext: false }));
  };
  const showNext = () => {
    setCurrentState((pre) => ({ ...pre, showNext: true }));
  };

  const navigate = useNavigate();
  const { deckID } = useParams();

  const correctSound = new Audio(`${process.env.PUBLIC_URL}/sound/true.mp3`);
  const incorrectSound = new Audio(`${process.env.PUBLIC_URL}/sound/false.mp3`);

  const playCorrectSound = () => {
    correctSound.play();
  };
  const playIncorrectSound = () => {
    incorrectSound.play();
  };

  const speakTerm = async () => {
    speak(currentQuestion.answer);
  };

  const fetchWords = async () => {
    try {
      const res = await learningService.getLearningTerms(deckID);
      if (!res.error) {
        const questions = generateQuestions(res.data.terms);
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

  return deck && terms ? (
    <div className="learn-wrapper">
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
              playCorrectSound={playCorrectSound}
              playIncorrectSound={playIncorrectSound}
              showNext={showNext}
            />
          ) : (
            <Fill
              question={currentQuestion}
              speakTerm={speakTerm}
              playCorrectSound={playCorrectSound}
              playIncorrectSound={playIncorrectSound}
              showNext={showNext}
            />
          )}
          <button
            className={`next-button${
              currentState.showNext ? "" : " display-none"
            }`}
            onClick={handleNextQuestionClick}
          >
            Next Question
          </button>
        </div>
      </div>
    </div>
  ) : (
    <LocalLoadingWrapper open={isLoading} />
  );
}

export default Revise;

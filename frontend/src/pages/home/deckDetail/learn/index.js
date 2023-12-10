import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CircleButton from "@components/circleButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { useEffect, useRef, useState } from "react";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { learningService } from "@api-services/learningService";
import { useNavigate, useParams } from "react-router-dom";
import { getFirstError } from "@utils/errorHandler";
import { toast } from "react-toastify";
import { LocalLoadingWrapper } from "@components/loading";
import { speak } from "@api-services/voiceService";
import { deckService } from "@api-services/deckService";
import { LEARNING_TERM_PAGE_SIZE } from "@constants/pageSize";

function LearnPage() {
  const [deck, setDeck] = useState();
  const [isLoading, setIsLoading] = useState(true);
  const [terms, setTerms] = useState();
  const touchStartRef = useRef(null);

  const [currentState, setCurrentState] = useState({
    index: 0,
    absolute_index: 0,
    isFlipped: false,
    latest_id: "",
    currentPage: 0,
  });
  let currentTerm = null;
  let youglish = null;
  let google = null;
  if (terms && terms.length > 0) {
    currentTerm = terms[currentState.index];
    const encodedPhrase = encodeURIComponent(currentTerm.name);
    const definitionPhrase = encodeURIComponent(
      currentTerm.name + " definition"
    );
    youglish = "https://youglish.com/pronounce/" + encodedPhrase + "/english";
    google = "https://www.google.com/search?q=" + definitionPhrase;
  }
  const navigate = useNavigate();
  const { deckID } = useParams();

  const handleTouchStart = (event) => {
    touchStartRef.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event) => {
    const touchEnd = event.changedTouches[0].clientX;
    const touchStart = touchStartRef.current;
    const distance = touchEnd - touchStart;
    if (currentState.index > 0 && distance > 50) {
      handleBack();
    } else if (currentState.index + 1 < terms.length && distance < -50) {
      handleNext();
    }
  };

  function handleClick() {
    setCurrentState((pre) => ({ ...pre, isFlipped: !pre.isFlipped }));
  }
  const speakTerm = () => {
    return speak(currentTerm.name);
  };
  const handleNext = async () => {
    if (currentState.index + 2 > terms.length) {
      fetchMore(currentState.currentPage + 1);
    } else {
      setCurrentState((pre) => ({
        ...pre,
        index: pre.index + 1,
        absolute_index: pre.absolute_index + 1,
        isFlipped: false,
      }));
    }
  };
  const handleBack = async () => {
    if (currentState.index === 0 && currentState.currentPage !== 1) {
      fetchMore(currentState.currentPage - 1, false);
    } else {
      setCurrentState((pre) => ({
        ...pre,
        index: pre.index - 1,
        absolute_index: pre.absolute_index - 1,
        isFlipped: false,
      }));
    }
  };
  const handleRestart = async () => {
    setCurrentState((pre) => ({ index: 0, isFlipped: false }));
  };

  const fetchMore = async (page, isNext = true) => {
    setIsLoading(true);
    try {
      const res = await learningService.getLearningTerms(deckID, page);
      if (!res.error) {
        const res_terms = res.data.results;

        if (isNext) {
          setTerms((pre) => [...pre, ...res_terms]);
          setCurrentState((pre) => ({
            ...pre,
            index: pre.index + 1,
            isFlipped: false,
            currentPage: pre.currentPage + 1,
            absolute_index: pre.absolute_index + 1,
          }));
        } else {
          setTerms((pre) => [...res_terms, ...pre]);
          setCurrentState((pre) => ({
            ...pre,
            index: pre.index + LEARNING_TERM_PAGE_SIZE - 1,
            isFlipped: false,
            currentPage: pre.currentPage - 1,
            absolute_index: pre.absolute_index - 1,
          }));
        }
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
  const fetchWords = async () => {
    try {
      const res1 = await learningService.getLatestLearnedTerm(deckID);
      if (!res1.error) {
        setCurrentState({
          index: res1.data.last_learned_index % LEARNING_TERM_PAGE_SIZE,
          absolute_index: res1.data.last_learned_index,
          latest_id: res1.data.latest_id,
          isFlipped: false,
          currentPage: res1.data.default_page,
        });
        const res2 = await learningService.getLearningTerms(
          deckID,
          res1.data.default_page
        );
        if (!res2.error) {
          setTerms(res2.data.results);
        } else {
          const errorMessage = getFirstError(res2.error);
          toast.error(errorMessage);
        }
      } else {
        const errorMessage = getFirstError(res1.error);
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

  const learned = async () => {
    learningService.create({ term_id: currentTerm.id });
  };

  useEffect(() => {
    fetchWords();
  }, []);

  useEffect(() => {
    if (currentTerm != null) {
      learned();
    }
  }, [currentTerm]);

  useEffect(() => {
    let timeoutId;

    if (currentTerm != null && currentState.isFlipped) {
      // Set a timeout to call speakTerm after 1000 milliseconds (1 second)
      timeoutId = setTimeout(() => {
        speakTerm();
      }, 1500);
    }

    // Cleanup function to clear the timeout if the component unmounts or the dependencies change
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentTerm, currentState.isFlipped, speakTerm]);

  useEffect(() => {
    if (deckID) {
      fetchDeck();
    }
  }, [deckID]);

  const handleKeyDown = (event) => {
    if (event.key === "ArrowRight") {
      if (
        terms &&
        currentState.absolute_index + 1 < deck.number_of_term &&
        !isLoading
      ) {
        handleNext();
      }
    }
    if (event.key === "ArrowLeft") {
      if (currentState.absolute_index > 0 && !isLoading) {
        handleBack();
      }
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);

    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentState.index]);

  return deck && terms ? (
    <div
      className="learn-wrapper"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="learn-header">
        <div className="left-header"></div>
        <div className="center-header">
          <div>{deck.name}</div>
          <span>{`${currentState.absolute_index + 1}/${
            deck.number_of_term
          }`}</span>
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
          <div
            className={`flip-card${currentState.isFlipped ? " flipped" : ""}`}
            onClick={handleClick}
          >
            <div className="flip-card-inner">
              <div className="flip-card-front">
                <div
                  className={`meaning-text ${
                    currentTerm.image ? "half-width" : ""
                  }`}
                >
                  <h1>{currentTerm.description}</h1>
                </div>
                {currentTerm.image && (
                  <div className="meaning-img">
                    <img src={currentTerm.image} alt="meaning" />
                  </div>
                )}
              </div>
              <div className="flip-card-back">
                {currentState.isFlipped && <h1>{currentTerm.name}</h1>}
              </div>
            </div>
          </div>
          <div className="learn-navigate">
            <div className="site-btn">
              <IconButton component="label" onClick={speakTerm}>
                <VolumeUpIcon />
              </IconButton>
              <IconButton component="label" onClick={handleRestart}>
                <RestartAltIcon />
              </IconButton>
            </div>
            <div className="navigate-btns">
              <CircleButton
                size={60}
                onClick={handleBack}
                disabled={
                  currentState.index === 0 && currentState.currentPage === 1
                }
              >
                <ArrowBackIcon />
              </CircleButton>
              <CircleButton
                onClick={handleNext}
                size={60}
                disabled={
                  currentState.absolute_index + 1 === deck.number_of_term
                }
              >
                <ArrowForwardIcon />
              </CircleButton>
            </div>
            <div className="site-btn">
              {youglish && (
                <a href={youglish} target="_blank" rel="noreferrer">
                  Youglish
                </a>
              )}
              {google && (
                <a href={google} target="_blank" rel="noreferrer">
                  Search on google
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      <LocalLoadingWrapper open={isLoading} />
    </div>
  ) : (
    <LocalLoadingWrapper />
  );
}

export default LearnPage;

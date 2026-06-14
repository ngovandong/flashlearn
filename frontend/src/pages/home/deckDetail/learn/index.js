import { Button, Chip, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CircleButton from "@components/circleButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { useCallback, useEffect, useRef, useState } from "react";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { learningService } from "@api-services/learningService";
import { termService } from "@api-services/termService";
import { useNavigate, useParams } from "react-router-dom";
import { getFirstError } from "@utils/errorHandler";
import { toast } from "react-toastify";
import { LocalLoadingWrapper } from "@components/loading";
import { speak } from "@api-services/voiceService";
import { deckService } from "@api-services/deckService";
import { LEARNING_TERM_PAGE_SIZE } from "@constants/pageSize";
import { highlightMainWord } from "@utils/exampleText";

function LearnPage()
{
  const [deck, setDeck] = useState();
  const [isLoading, setIsLoading] = useState(true);
  const [terms, setTerms] = useState();
  const [aiLoading, setAiLoading] = useState(false);
  const [newSynonym, setNewSynonym] = useState("");
  const [newAntonym, setNewAntonym] = useState("");
  const [newExample, setNewExample] = useState("");
  const [newWordForm, setNewWordForm] = useState("");
  const [newWordFamily, setNewWordFamily] = useState("");
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

  const handleTouchStart = (event) =>
  {
    touchStartRef.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event) =>
  {
    const touchEnd = event.changedTouches[0].clientX;
    const touchStart = touchStartRef.current;
    const distance = touchEnd - touchStart;
    if (currentState.index > 0 && distance > 50) {
      handleBack();
    } else if (currentState.index + 1 < terms.length && distance < -50) {
      handleNext();
    }
  };

  function handleClick()
  {
    setCurrentState((pre) => ({ ...pre, isFlipped: !pre.isFlipped }));
  }

  const [isStarred, setIsStarred] = useState(false);
  const handleStarClick = (e) =>
  {
    e.stopPropagation(); // Prevent card flip
    setIsStarred((prev) => !prev);
  };

  const speakTerm = useCallback(() =>
  {
    return speak(currentTerm?.name);
  }, [currentTerm]);
  const handleNext = async () =>
  {
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
  const handleBack = async () =>
  {
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
  const handleRestart = async () =>
  {
    setCurrentState((pre) => ({ index: 0, isFlipped: false }));
  };

  const fetchMore = async (page, isNext = true) =>
  {
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
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchWords = async () =>
  {
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
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchDeck = async () =>
  {
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
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const learned = async () =>
  {
    learningService.create({ term_id: currentTerm.id });
  };

  // Optimistically update the current card in local state, then persist the
  // full term to the backend.
  const persistTerm = async (updated) =>
  {
    setTerms((pre) =>
      pre.map((t, i) => (i === currentState.index ? updated : t))
    );
    try {
      await termService.updateTerms([
        {
          id: updated.id,
          name: updated.name,
          meaning: updated.meaning ?? "",
          image: typeof updated.image === "string" ? updated.image : "",
          word_type: updated.word_type,
          pronunciation: updated.pronunciation,
          definition: updated.definition,
          synonyms: updated.synonyms,
          antonyms: updated.antonyms,
          examples: updated.examples,
          word_forms: updated.word_forms,
          word_family: updated.word_family,
          ai_filled: true,
        },
      ]);
    } catch (error) {
      toast.error("Failed to save changes");
    }
  };

  const addListItem = (field, rawValue, reset) =>
  {
    const value = (rawValue || "").trim();
    if (!value || !currentTerm) return;
    persistTerm({
      ...currentTerm,
      [field]: [...(currentTerm[field] || []), value],
    });
    reset("");
  };

  const removeListItem = (field, idx) =>
  {
    if (!currentTerm) return;
    persistTerm({
      ...currentTerm,
      [field]: (currentTerm[field] || []).filter((_, i) => i !== idx),
    });
  };

  const handleFillWithAi = async () =>
  {
    if (!currentTerm || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await termService.aiEnrich(
        currentTerm.name,
        currentTerm.meaning || ""
      );
      if (res.error) {
        toast.error(getFirstError(res.error));
      } else {
        const d = res.data || {};
        await persistTerm({
          ...currentTerm,
          word_type: d.word_type || "",
          pronunciation: d.pronunciation || "",
          definition: d.definition || "",
          synonyms: d.synonyms || [],
          antonyms: d.antonyms || [],
          examples: d.examples || [],
          word_forms: d.word_forms || [],
          word_family: d.word_family || [],
        });
      }
    } catch (error) {
      toast.error("AI request failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() =>
  {
    fetchWords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() =>
  {
    if (currentTerm != null) {
      learned();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTerm]);

  useEffect(() =>
  {
    let timeoutId;

    if (currentTerm != null && currentState.isFlipped) {
      // Set a timeout to call speakTerm after 1000 milliseconds (1 second)
      timeoutId = setTimeout(() =>
      {
        speakTerm();
      }, 1500);
    }

    // Cleanup function to clear the timeout if the component unmounts or the dependencies change
    return () =>
    {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentTerm, currentState.isFlipped, speakTerm]);

  useEffect(() =>
  {
    if (deckID) {
      fetchDeck();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckID]);

  const handleKeyDown = (event) =>
  {
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

  useEffect(() =>
  {
    window.addEventListener("keydown", handleKeyDown);
    return () =>
    {
      window.removeEventListener("keydown", handleKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {/* <span style={{display:'none'}}>{`${currentState.absolute_index + 1}/${
            deck.number_of_term
          }`}</span> */}
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
        <div className="learn-container learn-page-grid">
          {/* --- Left Column --- */}
          <div className="learn-left-col">
            {/* Progress Bar (Mocked visual) */}
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${(currentState.absolute_index / deck.number_of_term) * 100
                    }%`,
                }}
              ></div>
            </div>
            <div style={{ textAlign: "center", marginBottom: "0.25rem", color: "#666", fontSize: "0.85rem" }}>
              Card {currentState.absolute_index + 1} of {deck.number_of_term}
            </div>

            {/* Flip Card */}
            <div
              className={`flip-card${currentState.isFlipped ? " flipped" : ""}`}
              onClick={handleClick}
            >
              <div className="flip-card-inner">
                <div className="flip-card-front">
                  <div className="star-btn">
                    <IconButton onClick={handleStarClick}>
                      {isStarred ? <StarIcon sx={{ color: '#FFD700', fontSize: '2rem' }} /> : <StarBorderIcon sx={{ fontSize: '2rem' }} />}
                    </IconButton>
                  </div>
                  <div className={`front-content ${currentTerm.image ? "has-image" : ""}`}>
                    <div className="meaning-text">
                      <h1>{currentTerm.name}</h1>
                      <p>Click to reveal meaning</p>
                    </div>
                    {currentTerm.image && (
                      <div className="meaning-img">
                        <img src={currentTerm.image} alt="meaning" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flip-card-back">
                  {currentTerm.pronunciation && (
                    <span className="term-pronunciation">{currentTerm.pronunciation}</span>
                  )}
                  <h1>{currentTerm.meaning}</h1>
                  {currentTerm.image && (
                    <div className="meaning-img">
                      <img src={currentTerm.image} alt="meaning" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Control Buttons - Restored Old UI */}
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

            <div className="definition-card">
              <div className="definition-header">
                <h3>Definition</h3>
                <div className="word-meta">
                  {currentTerm?.word_type && (
                    <span className="word-type-badge">{currentTerm.word_type}</span>
                  )}
                  {currentTerm?.pronunciation && (
                    <span className="pronunciation-text">
                      {currentTerm.pronunciation}
                      <IconButton size="small" onClick={speakTerm}>
                        <VolumeUpIcon fontSize="small" />
                      </IconButton>
                    </span>
                  )}
                </div>
              </div>
              <div className="definition-content">
                <p>{currentTerm?.definition || currentTerm?.meaning || "No definition available for this term."}</p>
              </div>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AutoFixHighIcon />}
                onClick={handleFillWithAi}
                disabled={aiLoading}
                sx={{ marginTop: "0.75rem" }}
              >
                {aiLoading
                  ? "Generating..."
                  : currentTerm?.ai_filled
                  ? "Regenerate with AI"
                  : "Fill with AI"}
              </Button>
            </div>
          </div>

          {/* --- Right Column --- */}
          <div className="learn-right-col">
            {/* Study Progress */}
            <div className="info-card">
              <h3>Study Progress</h3>
              <div className="studystats">
                <div className="stat-row">
                  <span>Total Revisions</span>
                  <span className="stat-value">
                    {currentTerm.total_revisions ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="info-card">
              <h3>Synonyms</h3>
              <div className="chip-group">
                {(currentTerm?.synonyms || []).map((s, i) => (
                  <Chip
                    key={`syn-${i}`}
                    label={s}
                    size="small"
                    color="primary"
                    variant="outlined"
                    onDelete={() => removeListItem("synonyms", i)}
                  />
                ))}
              </div>
              <div className="add-item-row">
                <input
                  className="add-item-input"
                  value={newSynonym}
                  onChange={(e) => setNewSynonym(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    addListItem("synonyms", newSynonym, setNewSynonym)
                  }
                  placeholder="Add a synonym"
                />
                <IconButton
                  size="small"
                  onClick={() => addListItem("synonyms", newSynonym, setNewSynonym)}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </div>
            </div>

            <div className="info-card">
              <h3>Antonyms</h3>
              <div className="chip-group">
                {(currentTerm?.antonyms || []).map((a, i) => (
                  <Chip
                    key={`ant-${i}`}
                    label={a}
                    size="small"
                    variant="outlined"
                    onDelete={() => removeListItem("antonyms", i)}
                  />
                ))}
              </div>
              <div className="add-item-row">
                <input
                  className="add-item-input"
                  value={newAntonym}
                  onChange={(e) => setNewAntonym(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    addListItem("antonyms", newAntonym, setNewAntonym)
                  }
                  placeholder="Add an antonym"
                />
                <IconButton
                  size="small"
                  onClick={() => addListItem("antonyms", newAntonym, setNewAntonym)}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </div>
            </div>

            <div className="info-card">
              <h3>Word forms</h3>
              <div className="chip-group">
                {(currentTerm?.word_forms || []).map((w, i) => (
                  <Chip
                    key={`wf-${i}`}
                    label={w}
                    size="small"
                    color="secondary"
                    variant="outlined"
                    onDelete={() => removeListItem("word_forms", i)}
                  />
                ))}
              </div>
              <div className="add-item-row">
                <input
                  className="add-item-input"
                  value={newWordForm}
                  onChange={(e) => setNewWordForm(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    addListItem("word_forms", newWordForm, setNewWordForm)
                  }
                  placeholder="e.g. past tense: ran"
                />
                <IconButton
                  size="small"
                  onClick={() =>
                    addListItem("word_forms", newWordForm, setNewWordForm)
                  }
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </div>
            </div>

            <div className="info-card">
              <h3>Word family</h3>
              <div className="chip-group">
                {(currentTerm?.word_family || []).map((w, i) => (
                  <Chip
                    key={`wfam-${i}`}
                    label={w}
                    size="small"
                    variant="outlined"
                    onDelete={() => removeListItem("word_family", i)}
                  />
                ))}
              </div>
              <div className="add-item-row">
                <input
                  className="add-item-input"
                  value={newWordFamily}
                  onChange={(e) => setNewWordFamily(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    addListItem("word_family", newWordFamily, setNewWordFamily)
                  }
                  placeholder="e.g. noun: specification"
                />
                <IconButton
                  size="small"
                  onClick={() =>
                    addListItem("word_family", newWordFamily, setNewWordFamily)
                  }
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </div>
            </div>

            <div className="info-card">
              <h3>Examples</h3>
              <ul className="example-list">
                {(currentTerm?.examples || []).map((ex, i) => (
                  <li key={`ex-${i}`}>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: highlightMainWord(ex, currentTerm.name),
                      }}
                    />
                    <IconButton
                      size="small"
                      className="example-delete"
                      onClick={() => removeListItem("examples", i)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </li>
                ))}
              </ul>
              <div className="add-item-row">
                <input
                  className="add-item-input"
                  value={newExample}
                  onChange={(e) => setNewExample(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    addListItem("examples", newExample, setNewExample)
                  }
                  placeholder="Add an example sentence"
                />
                <IconButton
                  size="small"
                  onClick={() => addListItem("examples", newExample, setNewExample)}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </div>
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

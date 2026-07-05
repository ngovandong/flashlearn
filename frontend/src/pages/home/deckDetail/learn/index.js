import { Button, Chip, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CircleButton from "@components/circleButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ShuffleIcon from "@mui/icons-material/Shuffle";
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

// Fisher–Yates shuffle over [0, n) — produces a random visiting order of the
// deck's absolute term indices.
function buildShuffledOrder(n)
{
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function LearnPage()
{
  const [deck, setDeck] = useState();
  const [isLoading, setIsLoading] = useState(true);
  // Terms are cached per API page (page -> term[]); navigation jumps to any
  // absolute index and lazily loads the page that contains it.
  const [termsByPage, setTermsByPage] = useState({});
  // `order` maps a session position -> absolute term index. Sequential mode is
  // the identity order; shuffle mode is a random permutation.
  const [order, setOrder] = useState(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [newSynonym, setNewSynonym] = useState("");
  const [newAntonym, setNewAntonym] = useState("");
  const [newExample, setNewExample] = useState("");
  const [newWordForm, setNewWordForm] = useState("");
  const [newWordFamily, setNewWordFamily] = useState("");
  const touchStartRef = useRef(null);
  // Last successfully loaded term — kept visible while the next page loads so
  // the card doesn't flash the full-screen loader on every page boundary.
  const lastTermRef = useRef(null);
  const fetchingPagesRef = useRef(new Set());

  const [currentState, setCurrentState] = useState({
    position: 0,
    isFlipped: false,
    latest_id: "",
  });

  const totalTerms = deck?.number_of_term ?? 0;
  const absoluteIndex =
    order && order.length > 0 ? order[currentState.position] : null;

  let loadedTerm = null;
  if (absoluteIndex != null) {
    const page = Math.floor(absoluteIndex / LEARNING_TERM_PAGE_SIZE) + 1;
    const offset = absoluteIndex % LEARNING_TERM_PAGE_SIZE;
    loadedTerm = termsByPage[page]?.[offset] ?? null;
  }
  if (loadedTerm) {
    lastTermRef.current = loadedTerm;
  }
  const currentTerm = loadedTerm || lastTermRef.current;

  let youglish = null;
  let google = null;
  if (currentTerm) {
    const encodedPhrase = encodeURIComponent(currentTerm.name);
    const definitionPhrase = encodeURIComponent(
      currentTerm.name + " definition"
    );
    youglish = "https://youglish.com/pronounce/" + encodedPhrase + "/english";
    google = "https://www.google.com/search?q=" + definitionPhrase;
  }
  const navigate = useNavigate();
  // When termId is present (deep-link, e.g. from the Speaking Coach) the deck
  // opens at that specific term instead of the user's last-learned position.
  const { deckID, termId } = useParams();

  const handleTouchStart = (event) =>
  {
    touchStartRef.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event) =>
  {
    const touchEnd = event.changedTouches[0].clientX;
    const touchStart = touchStartRef.current;
    const distance = touchEnd - touchStart;
    if (currentState.position > 0 && distance > 50) {
      handleBack();
    } else if (currentState.position + 1 < totalTerms && distance < -50) {
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
  const handleNext = () =>
  {
    setCurrentState((pre) =>
      pre.position + 1 < totalTerms
        ? { ...pre, position: pre.position + 1, isFlipped: false }
        : pre
    );
  };
  const handleBack = () =>
  {
    setCurrentState((pre) =>
      pre.position > 0
        ? { ...pre, position: pre.position - 1, isFlipped: false }
        : pre
    );
  };
  const handleRestart = () =>
  {
    setCurrentState((pre) => ({ ...pre, position: 0, isFlipped: false }));
  };

  // Toggle between sequential (newest→oldest) and shuffled study order. When
  // enabling shuffle the current card is moved to the front so the view stays
  // put; disabling resumes sequentially from the current term.
  const toggleShuffle = () =>
  {
    if (!order || totalTerms === 0) return;
    const currentAbs = order[currentState.position];
    if (!isShuffled) {
      const perm = buildShuffledOrder(totalTerms);
      const at = perm.indexOf(currentAbs);
      if (at > 0) {
        perm[at] = perm[0];
        perm[0] = currentAbs;
      }
      setOrder(perm);
      setIsShuffled(true);
      setCurrentState((pre) => ({ ...pre, position: 0, isFlipped: false }));
    } else {
      setOrder(Array.from({ length: totalTerms }, (_, i) => i));
      setIsShuffled(false);
      setCurrentState((pre) => ({
        ...pre,
        position: currentAbs,
        isFlipped: false,
      }));
    }
  };

  // Lazily load the API page that holds the current absolute index into the
  // per-page cache. Deduplicates concurrent requests for the same page.
  const ensurePageLoaded = useCallback(
    async (page) =>
    {
      if (termsByPage[page] || fetchingPagesRef.current.has(page)) return;
      fetchingPagesRef.current.add(page);
      setIsLoading(true);
      try {
        const res = await learningService.getLearningTerms(deckID, page);
        if (!res.error) {
          setTermsByPage((pre) => ({ ...pre, [page]: res.data.results }));
        } else {
          toast.error(getFirstError(res.error));
        }
      } catch (error) {
        // Swallow; the loading overlay is cleared in `finally`.
      } finally {
        fetchingPagesRef.current.delete(page);
        setIsLoading(false);
      }
    },
    [deckID, termsByPage]
  );

  const fetchWords = async () =>
  {
    try {
      const res1 = await learningService.getLatestLearnedTerm(deckID, termId);
      if (!res1.error) {
        // `last_learned_index` is an absolute index; the sequential `order`
        // (identity) maps position directly onto it.
        setCurrentState({
          position: res1.data.last_learned_index,
          latest_id: res1.data.latest_id,
          isFlipped: false,
        });
      } else {
        toast.error(getFirstError(res1.error));
      }
    } catch (error) {
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

  // Optimistically update the current card in the page cache, then persist the
  // full term to the backend.
  const persistTerm = async (updated) =>
  {
    if (absoluteIndex == null) return;
    const page = Math.floor(absoluteIndex / LEARNING_TERM_PAGE_SIZE) + 1;
    const offset = absoluteIndex % LEARNING_TERM_PAGE_SIZE;
    setTermsByPage((pre) => ({
      ...pre,
      [page]: (pre[page] || []).map((t, i) => (i === offset ? updated : t)),
    }));
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
    // A fresh mount / deep-link resumes sequentially from the resolved index.
    setIsShuffled(false);
    setOrder(null);
    fetchWords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  // Build the sequential (identity) order once the deck size is known and no
  // order exists yet (initial load, or after a resume reset above).
  useEffect(() =>
  {
    if (deck?.number_of_term != null && order === null) {
      setOrder(Array.from({ length: deck.number_of_term }, (_, i) => i));
    }
  }, [deck, order]);

  // Load the page that contains the current absolute index on demand.
  useEffect(() =>
  {
    if (absoluteIndex == null) return;
    const page = Math.floor(absoluteIndex / LEARNING_TERM_PAGE_SIZE) + 1;
    if (!termsByPage[page]) {
      ensurePageLoaded(page);
    }
  }, [absoluteIndex, termsByPage, ensurePageLoaded]);

  useEffect(() =>
  {
    if (loadedTerm != null) {
      learningService.create({ term_id: loadedTerm.id });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedTerm]);

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
      if (currentState.position + 1 < totalTerms && !isLoading) {
        handleNext();
      }
    }
    if (event.key === "ArrowLeft") {
      if (currentState.position > 0 && !isLoading) {
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
  }, [currentState.position, totalTerms, isLoading]);

  return deck && currentTerm ? (
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
                  width: `${(currentState.position / totalTerms) * 100
                    }%`,
                }}
              ></div>
            </div>
            <div style={{ textAlign: "center", marginBottom: "0.25rem", color: "#666", fontSize: "0.85rem" }}>
              Card {currentState.position + 1} of {totalTerms}
              {isShuffled && " · Shuffled"}
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
                  disabled={currentState.position === 0}
                >
                  <ArrowBackIcon />
                </CircleButton>
                <CircleButton
                  size={60}
                  onClick={toggleShuffle}
                  active={isShuffled}
                  title={isShuffled ? "Shuffle: on" : "Shuffle: off"}
                >
                  <ShuffleIcon />
                </CircleButton>
                <CircleButton
                  onClick={handleNext}
                  size={60}
                  disabled={currentState.position + 1 === totalTerms}
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
                    Search on Google
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
                  ? "Generating…"
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
              <h3>Study progress</h3>
              <div className="studystats">
                <div className="stat-row">
                  <span>Total revisions</span>
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

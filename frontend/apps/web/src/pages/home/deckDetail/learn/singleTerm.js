import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Chip, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { termService } from "@api-services/termService";
import { speak } from "@api-services/voiceService";
import { getFirstError } from "@utils/errorHandler";
import { toast } from "react-toastify";
import { LocalLoadingWrapper } from "@components/loading";
import { highlightMainWord } from "@utils/exampleText";

// Focused, read-only study view for a single term, opened via /learn/:termId
// (e.g. from a saved-term highlight in the Speaking Coach). The full deck-based
// flashcard flow still lives at /deck/:deckID/learn.
function SingleTermLearn() {
  const { termId } = useParams();
  const navigate = useNavigate();
  const [term, setTerm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    termService.retrieve(termId).then((res) => {
      if (!active) return;
      if (res.error || !res.data?.id) {
        toast.error(getFirstError(res.error) || "Term not found.");
      } else {
        setTerm(res.data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [termId]);

  const speakTerm = useCallback(() => term && speak(term.name), [term]);

  const close = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  if (loading) return <LocalLoadingWrapper />;
  if (!term) {
    return (
      <div className="learn-wrapper">
        <div className="learn-header">
          <div className="left-header" />
          <div className="center-header">
            <div>Term not found</div>
          </div>
          <div className="right-header">
            <div className="close-btn">
              <IconButton onClick={close}>
                <CloseIcon />
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chipSection = (title, items, color) =>
    items?.length ? (
      <div className="info-card">
        <h3>{title}</h3>
        <div className="chip-group">
          {items.map((value, i) => (
            <Chip
              key={`${title}-${i}`}
              label={value}
              size="small"
              color={color}
              variant="outlined"
            />
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="learn-wrapper">
      <div className="learn-header">
        <div className="left-header" />
        <div className="center-header">
          <div>Study term</div>
        </div>
        <div className="right-header">
          <div className="close-btn">
            <IconButton onClick={close}>
              <CloseIcon />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="learn-body">
        <div
          className="learn-container"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            maxWidth: "720px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div className="definition-card">
            <div className="definition-header">
              <h3>{term.name}</h3>
              <div className="word-meta">
                {term.word_type && (
                  <span className="word-type-badge">{term.word_type}</span>
                )}
                {term.pronunciation && (
                  <span className="pronunciation-text">
                    {term.pronunciation}
                    <IconButton size="small" onClick={speakTerm}>
                      <VolumeUpIcon fontSize="small" />
                    </IconButton>
                  </span>
                )}
              </div>
            </div>
            {term.image && (
              <div className="meaning-img" style={{ margin: "0.5rem 0" }}>
                <img src={term.image} alt={term.name} />
              </div>
            )}
            <div className="definition-content">
              {term.meaning && (
                <p>
                  <strong>Meaning:</strong> {term.meaning}
                </p>
              )}
              <p>{term.definition || "No definition available for this term."}</p>
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginTop: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={<VolumeUpIcon />}
                onClick={speakTerm}
              >
                Listen
              </Button>
              {term.deck && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<OpenInNewIcon />}
                  onClick={() => navigate(`/deck/${term.deck}/learn`)}
                >
                  Study in deck
                </Button>
              )}
            </div>
          </div>

          {chipSection("Synonyms", term.synonyms, "primary")}
          {chipSection("Antonyms", term.antonyms)}
          {chipSection("Word forms", term.word_forms, "secondary")}
          {chipSection("Word family", term.word_family)}

          {term.examples?.length > 0 && (
            <div className="info-card">
              <h3>Examples</h3>
              <ul className="example-list">
                {term.examples.map((ex, i) => (
                  <li key={`ex-${i}`}>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: highlightMainWord(ex, term.name),
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SingleTermLearn;

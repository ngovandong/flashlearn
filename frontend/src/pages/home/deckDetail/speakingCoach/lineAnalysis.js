import React, { useState, useRef, useEffect } from "react";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import MicIcon from "@mui/icons-material/Mic";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import InsightsIcon from "@mui/icons-material/Insights";

const scoreLevel = (score) => (score >= 80 ? "good" : score >= 50 ? "mid" : "low");

const wpmStatus = (wpm) => {
  if (wpm < 100) return { label: "Slow & deliberate", level: "mid" };
  if (wpm <= 160) return { label: "Optimal pace", level: "good" };
  return { label: "Fast speech", level: "low" };
};

/**
 * Renders a pronunciation diagnostics card from a backend analysis result.
 * Pure display: it only calls back to the parent for saving words/sentences
 * and replaying audio.
 */
export default function LineAnalysis({
  result,
  onSaveWord,
  onSaveSentence,
  onPlayReference,
  onPlayWord,
  savedWords = {},
}) {
  const [selectedWord, setSelectedWord] = useState(
    result.wordAnalysis.find((w) => w.status !== "correct") ||
      result.wordAnalysis[0] ||
      null
  );
  const [isUserPlaying, setIsUserPlaying] = useState(false);
  const userAudioRef = useRef(null);

  // The component is reused across consecutive analyses, so the cached Audio
  // element must be rebuilt whenever a new recording arrives — otherwise
  // "My recording" replays a stale clip.
  useEffect(() => {
    userAudioRef.current?.pause();
    userAudioRef.current = null;
    setIsUserPlaying(false);
  }, [result.userAudioUrl]);

  const handlePlayUserAudio = () => {
    if (!result.userAudioUrl) return;
    if (isUserPlaying) {
      userAudioRef.current?.pause();
      setIsUserPlaying(false);
    } else {
      if (!userAudioRef.current) {
        userAudioRef.current = new Audio(result.userAudioUrl);
        userAudioRef.current.onended = () => setIsUserPlaying(false);
      }
      userAudioRef.current.play();
      setIsUserPlaying(true);
    }
  };

  const accuracy = result.accuracyScore || 0;
  const fluency = result.fluencyScore || 0;
  const rhythm = result.rhythmScore || 0;
  const completeness = result.completenessScore || 0;
  const wpm = result.wordsPerMinute || 0;
  const wpmInfo = wpmStatus(wpm);

  const metrics = [
    { key: "fluency", label: "Fluency", value: fluency, hint: "Smooth, natural delivery." },
    { key: "rhythm", label: "Rhythm", value: rhythm, hint: "Word stress & contractions." },
    { key: "completeness", label: "Completeness", value: completeness, hint: "All words spoken." },
  ];

  return (
    <div className="sc-analysis">
      <div className="sc-analysis__head">
        <div className="sc-analysis__title">
          <span className="sc-chip-icon">
            <InsightsIcon fontSize="small" />
          </span>
          <div>
            <h3>Pronunciation diagnostics</h3>
            <p>Syllable stress, phonetics, and physical correction guidance.</p>
          </div>
        </div>
        <button className="sc-btn sc-btn--ghost" onClick={onSaveSentence}>
          <BookmarkBorderIcon fontSize="small" />
          Save sentence
        </button>
      </div>

      <div className="sc-metrics">
        <div className="sc-gauge">
          <span className="sc-gauge__label">Overall accuracy</span>
          <div className="sc-gauge__ring">
            <svg viewBox="0 0 80 80">
              <circle className="sc-gauge__bg" cx="40" cy="40" r="34" strokeWidth="6" />
              <circle
                className={`sc-gauge__fg sc-gauge__fg--${scoreLevel(accuracy)}`}
                cx="40"
                cy="40"
                r="34"
                strokeWidth="6"
                strokeDasharray="213.6"
                strokeDashoffset={213.6 - (213.6 * accuracy) / 100}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <span className="sc-gauge__value">{accuracy}%</span>
          </div>
        </div>

        {metrics.map((m) => (
          <div key={m.key} className="sc-bar-card">
            <div className="sc-bar-card__head">
              <span>{m.label}</span>
              <span className={`sc-pct sc-pct--${scoreLevel(m.value)}`}>{m.value}%</span>
            </div>
            <p>{m.hint}</p>
            <div className="sc-bar-track">
              <div
                className={`sc-bar-fill sc-bar-fill--${scoreLevel(m.value)}`}
                style={{ width: `${m.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="sc-audio-studio">
        <div className="sc-audio-studio__info">
          <span className="sc-chip-icon sc-chip-icon--solid">
            <VolumeUpIcon fontSize="small" />
          </span>
          <div>
            <h4>Audio comparison</h4>
            <p>Listen to the reference voice and your recording.</p>
          </div>
        </div>
        <div className="sc-audio-studio__actions">
          {onPlayReference && (
            <button className="sc-btn sc-btn--ghost" onClick={onPlayReference}>
              <VolumeUpIcon fontSize="small" />
              Listen to reference
            </button>
          )}
          {result.userAudioUrl ? (
            <button
              className={`sc-btn ${isUserPlaying ? "sc-btn--danger" : "sc-btn--primary"}`}
              onClick={handlePlayUserAudio}
            >
              <MicIcon fontSize="small" />
              {isUserPlaying ? "Playing…" : "My recording"}
            </button>
          ) : (
            <span className="sc-muted-pill">Recording replay unavailable</span>
          )}
        </div>
      </div>

      {wpm > 0 && (
        <div className="sc-wpm">
          <span className="sc-chip-icon">
            <LocalFireDepartmentIcon fontSize="small" />
          </span>
          <div className="sc-wpm__text">
            <p>
              Speaking tempo: <strong>{wpm} WPM</strong>
            </p>
            <span>A relaxed conversational pace keeps you clear and easy to understand.</span>
          </div>
          <span className={`sc-tag sc-tag--${wpmInfo.level}`}>{wpmInfo.label}</span>
        </div>
      )}

      {result.accentAnalysis && (
        <div className="sc-callout sc-callout--warn">
          <WarningAmberIcon fontSize="small" />
          <div>
            <h5>Accent & intonation insight</h5>
            <p>{result.accentAnalysis}</p>
          </div>
        </div>
      )}

      {result.keyStruggles?.length > 0 && (
        <div className="sc-struggles">
          <span className="sc-section-label">Key vocal challenges</span>
          <div className="sc-struggles__grid">
            {result.keyStruggles.map((s, i) => (
              <div key={i} className="sc-struggle">
                <h5>
                  <span className="sc-mono">{s.sound}</span>
                </h5>
                <p>{s.description}</p>
                <div className="sc-struggle__tip">
                  <strong>Tip:</strong> {s.tip}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.wordAnalysis.length > 0 && (
        <div className="sc-wordmap">
          <span className="sc-section-label">Interactive sentence map</span>
          <p className="sc-hint">Tap any word to view its acoustic guide.</p>
          <div className="sc-wordmap__words">
            {result.wordAnalysis.map((word, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedWord(word)}
                className={`sc-word sc-word--${word.status} ${
                  selectedWord?.word === word.word ? "sc-word--active" : ""
                }`}
              >
                {word.word}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedWord && (
        <div className="sc-word-detail">
          <div className="sc-word-detail__head">
            <div className="sc-word-detail__title">
              <span className="sc-mono sc-mono--lg">"{selectedWord.word}"</span>
              {onPlayWord && (
                <button
                  type="button"
                  className="sc-icon-btn"
                  onClick={() => onPlayWord(selectedWord.word)}
                  title="Hear the correct pronunciation"
                >
                  <VolumeUpIcon fontSize="small" />
                </button>
              )}
              <span className={`sc-status sc-status--${selectedWord.status}`}>
                {selectedWord.status === "correct" && <CheckCircleIcon fontSize="inherit" />}
                {selectedWord.status === "incorrect" && <CancelIcon fontSize="inherit" />}
                {selectedWord.status === "missing" && <WarningAmberIcon fontSize="inherit" />}
                {selectedWord.status}
              </span>
              {selectedWord.accuracyScore > 0 && (
                <span className={`sc-pct sc-pct--${scoreLevel(selectedWord.accuracyScore)}`}>
                  {selectedWord.accuracyScore}%
                </span>
              )}
            </div>
            <button
              className="sc-btn sc-btn--primary sc-btn--sm"
              onClick={() => onSaveWord(selectedWord)}
              disabled={savedWords[selectedWord.word]}
            >
              <AddIcon fontSize="small" />
              {savedWords[selectedWord.word] ? "Saved" : "Save as term"}
            </button>
          </div>

          <div className="sc-word-detail__grid">
            <div className="sc-word-cell">
              <span className="sc-cell-label">Target IPA</span>
              <span className="sc-mono sc-mono--good">{selectedWord.ipaTarget || "/--/"}</span>
              {selectedWord.correctPronunciation && (
                <span className="sc-cell-note">Like: {selectedWord.correctPronunciation}</span>
              )}
            </div>
            <div className="sc-word-cell">
              <span className="sc-cell-label">Detected IPA</span>
              <span className="sc-mono sc-mono--bad">
                {selectedWord.ipaSpoken || selectedWord.userPronunciation || "/--/"}
              </span>
              {selectedWord.userPronunciation && (
                <span className="sc-cell-note">Heard: "{selectedWord.userPronunciation}"</span>
              )}
            </div>
            <div className="sc-word-cell">
              <span className="sc-cell-label">Syllable stress</span>
              <span className="sc-cell-note">
                {selectedWord.syllableStress || "No stress details noted."}
              </span>
            </div>
          </div>

          {selectedWord.mouthTip && (
            <div className="sc-word-detail__tip">
              <AutoAwesomeIcon fontSize="small" />
              <div>
                <h6>Vocal correction tip</h6>
                <p>{selectedWord.mouthTip}</p>
              </div>
            </div>
          )}

          {selectedWord.feedback && (
            <div className="sc-word-detail__feedback">"{selectedWord.feedback}"</div>
          )}
        </div>
      )}
    </div>
  );
}

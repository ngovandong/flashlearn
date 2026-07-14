import React, { useRef } from "react";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";

// Play the clip, type what you hear. The target is never sent to the client
// until it's revealed after grading.
function ListeningCard({ card, answered, result, value, onChange }) {
  const audioRef = useRef(null);
  const audioUrl = card.payload?.audio_url;

  const play = () => {
    if (!audioUrl) return;
    if (!audioRef.current) audioRef.current = new Audio(audioUrl);
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  return (
    <div className="revise-card revise-card--listening">
      <span className="revise-card__kind">Listening</span>
      <p className="revise-card__hint">{card.prompt}</p>
      <button type="button" className="revise-play" onClick={play} aria-label="Play audio">
        <PlayArrowRoundedIcon />
        <span>Play</span>
      </button>
      <input
        className={`revise-textline ${
          answered ? (result?.correct ? "is-correct" : "is-wrong") : ""
        }`}
        value={value || ""}
        disabled={answered}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type what you hear…"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {answered && !result?.correct && (
        <p className="revise-card__reveal">
          Answer: <strong>{result?.answer}</strong>
        </p>
      )}
    </div>
  );
}

export default ListeningCard;

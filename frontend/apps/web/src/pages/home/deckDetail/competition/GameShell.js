import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

let popupSeq = 0;

// Chrome shared by every competition game: a top bar with back, title, live
// score / best and a mute toggle. The score number bumps and spits out a
// floating "+N" every time it climbs, which gives every game some juice.
export default function GameShell({
  title,
  score = 0,
  best,
  sound,
  onLeaderboard,
  children,
}) {
  const navigate = useNavigate();
  const [bump, setBump] = useState(false);
  const [popups, setPopups] = useState([]);
  const prevScore = useRef(score);

  useEffect(() => {
    const delta = score - prevScore.current;
    prevScore.current = score;
    if (delta > 0) {
      setBump(true);
      const id = ++popupSeq;
      setPopups((list) => [...list, { id, text: `+${delta}` }]);
      const t1 = setTimeout(() => setBump(false), 260);
      const t2 = setTimeout(
        () => setPopups((list) => list.filter((p) => p.id !== id)),
        900
      );
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    return undefined;
  }, [score]);

  return (
    <div className="cmp-shell">
      <header className="cmp-shell__bar">
        <button
          type="button"
          className="cmp-icon-btn"
          onClick={() => navigate("..")}
          aria-label="Back to games"
        >
          <ArrowBackIcon />
        </button>
        <h2 className="cmp-shell__title">{title}</h2>
        <div className="cmp-shell__meta">
          <span className="cmp-score-wrap">
            <span className={`cmp-score${bump ? " bump" : ""}`}>{score}</span>
            {popups.map((p) => (
              <span key={p.id} className="cmp-score-pop">
                {p.text}
              </span>
            ))}
          </span>
          {best > 0 && (
            <span className="cmp-best" title="Your best">
              <EmojiEventsIcon fontSize="small" />
              {best}
            </span>
          )}
          {onLeaderboard && (
            <button
              type="button"
              className="cmp-icon-btn"
              onClick={onLeaderboard}
              aria-label="Leaderboard"
            >
              <EmojiEventsIcon />
            </button>
          )}
          <button
            type="button"
            className="cmp-icon-btn"
            onClick={sound.toggleMute}
            aria-label={sound.muted ? "Unmute" : "Mute"}
          >
            {sound.muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </button>
        </div>
      </header>
      <div className="cmp-shell__stage">{children}</div>
    </div>
  );
}

import React from "react";
import ReplayIcon from "@mui/icons-material/Replay";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

export default function GameOverCard({
  score,
  best,
  isNewBest,
  rank,
  onPlayAgain,
  onLeaderboard,
}) {
  return (
    <div className="cmp-over">
      <div className="cmp-over__card">
        {isNewBest && <div className="cmp-over__badge">New best!</div>}
        <h3>{isNewBest ? "Record broken!" : "Game over"}</h3>
        <div className="cmp-over__score">{score}</div>
        <p className="cmp-over__sub">
          {isNewBest
            ? "You beat your previous best."
            : `Your best is ${best}.`}
          {rank ? ` Ranked #${rank}.` : ""}
        </p>
        <div className="cmp-over__actions">
          <button type="button" className="cmp-btn" onClick={onPlayAgain}>
            <ReplayIcon fontSize="small" /> Play again
          </button>
          <button
            type="button"
            className="cmp-btn cmp-btn--ghost"
            onClick={onLeaderboard}
          >
            <EmojiEventsIcon fontSize="small" /> Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}

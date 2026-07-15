import React from "react";
import { Modal, Fade, Backdrop } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

const MEDALS = ["gold", "silver", "bronze"];

export default function Leaderboard({ open, onClose, title, data, loading }) {
  const entries = data?.entries ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{ backdrop: { timeout: 250 } }}
    >
      <Fade in={open}>
        <div className="cmp-leaderboard">
          <div className="cmp-leaderboard__head">
            <EmojiEventsIcon />
            <h3>{title} leaderboard</h3>
          </div>
          {loading ? (
            <p className="cmp-leaderboard__empty">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="cmp-leaderboard__empty">
              No scores yet — be the first to set a record!
            </p>
          ) : (
            <ol className="cmp-leaderboard__list">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.player.id}-${index}`}
                  className={`cmp-leaderboard__row ${
                    index < 3 ? `medal-${MEDALS[index]}` : ""
                  }`}
                >
                  <span className="cmp-rank">{index + 1}</span>
                  <span className="cmp-player">{entry.player.name}</span>
                  <span className="cmp-points">{entry.score}</span>
                </li>
              ))}
            </ol>
          )}
          {data?.my_rank && (
            <div className="cmp-leaderboard__you">
              You are ranked #{data.my_rank} with {data.my_score} points
            </div>
          )}
          <button type="button" className="cmp-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </Fade>
    </Modal>
  );
}

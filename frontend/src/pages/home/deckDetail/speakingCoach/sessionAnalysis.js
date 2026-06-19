import React, { useState } from "react";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import LineAnalysis from "./lineAnalysis";

const scoreLevel = (score) => (score >= 80 ? "good" : score >= 50 ? "mid" : "low");

/**
 * Renders a role-play session as one collapsible section per spoken sentence.
 * The first section is open by default; clicking a section's header toggles it
 * open or closed (only one section is open at a time).
 */
export default function SessionAnalysis({
  sessions,
  savedWords = {},
  onSaveWord,
  onPlayWord,
  onSaveSentence,
  onPlayReference,
}) {
  const [pinned, setPinned] = useState(0);

  return (
    <div className="sc-sessions">
      <div className="sc-sessions__head">
        <span className="sc-section-label">Per-sentence breakdown</span>
        <span className="sc-sessions__hint">Tap a sentence to expand or collapse it.</span>
      </div>

      {sessions.map((session, index) => {
        const open = index === pinned;
        const accuracy = session.result.accuracyScore || 0;
        return (
          <div
            key={session.id || index}
            className={`sc-session ${open ? "sc-session--open" : ""}`}
          >
            <button
              type="button"
              className="sc-session__head"
              onClick={() => setPinned((p) => (p === index ? -1 : index))}
              aria-expanded={open}
            >
              <span className="sc-session__index">{index + 1}</span>
              <span className="sc-session__text">{session.text}</span>
              <span className={`sc-pct sc-pct--${scoreLevel(accuracy)}`}>{accuracy}%</span>
              <KeyboardArrowDownIcon className="sc-session__chev" fontSize="small" />
            </button>

            {open && (
              <div className="sc-session__body">
                <LineAnalysis
                  result={session.result}
                  savedWords={savedWords}
                  onSaveWord={onSaveWord}
                  onPlayWord={onPlayWord}
                  onSaveSentence={() => onSaveSentence(session.text)}
                  onPlayReference={() => onPlayReference(session.text)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

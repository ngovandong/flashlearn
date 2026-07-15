import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import BorderColorIcon from "@mui/icons-material/BorderColor";

// Vocabulary popup shared by both Writing Coach modes. Shows the meaning,
// pronunciation, examples and lets the user highlight the phrase on the session
// or save it as a term in their default deck.
export default function VocabModal({
  selected,
  canHighlight,
  isHighlighted,
  noteDraft,
  onNoteChange,
  onClose,
  onRetry,
  onListen,
  onToggleHighlight,
  onSaveTerm,
}) {
  if (!selected) return null;
  const highlighted = isHighlighted(selected.text);
  return (
    <div className="wc-modal" onClick={onClose}>
      <div className="wc-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="wc-modal__head">
          <div>
            <span className="wc-modal__eyebrow">Vocabulary coach</span>
            <h3>"{selected.text}"</h3>
          </div>
          <button className="wc-icon-btn wc-icon-btn--light" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </button>
        </div>

        <div className="wc-modal__body">
          {selected.loading ? (
            <div className="wc-modal__loading">
              <div className="wc-spinner" />
              <p>Looking it up…</p>
            </div>
          ) : selected.error ? (
            <div className="wc-modal__error">
              <p>{selected.error}</p>
              <button className="wc-btn wc-btn--ghost wc-btn--sm" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="wc-modal__meaning">
                <span className="wc-section-label">Meaning</span>
                <p>{selected.explain?.meaning || selected.fields?.definition || "—"}</p>
              </div>
              <div className="wc-grid-2">
                <div className="wc-modal__cell">
                  <span className="wc-section-label">Pronunciation</span>
                  <span className="wc-mono wc-mono--good">
                    {selected.fields?.pronunciation || "/--/"}
                  </span>
                </div>
                <div className="wc-modal__cell">
                  <span className="wc-section-label">Word type</span>
                  <span>{selected.fields?.word_type || "—"}</span>
                </div>
              </div>
              {selected.explain?.examples?.length > 0 && (
                <div className="wc-modal__cell">
                  <span className="wc-section-label">In context</span>
                  <p>{selected.explain.examples[0]}</p>
                </div>
              )}
              {selected.fields?.examples?.length > 0 && (
                <div className="wc-modal__cell">
                  <span className="wc-section-label">Example</span>
                  <p
                    className="wc-modal__example"
                    dangerouslySetInnerHTML={{ __html: selected.fields.examples[0] }}
                  />
                </div>
              )}
              {canHighlight && (
                <div className="wc-modal__note">
                  <span className="wc-section-label">Note (optional)</span>
                  <input
                    type="text"
                    value={noteDraft}
                    onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="Add a quick note for this highlight…"
                  />
                  <div className="wc-modal__note-actions">
                    <button
                      className={`wc-btn wc-btn--sm ${
                        highlighted ? "wc-btn--primary" : "wc-btn--ghost"
                      }`}
                      onClick={() => onToggleHighlight(false)}
                    >
                      <BorderColorIcon fontSize="small" />
                      {highlighted ? "Update highlight" : "Highlight here"}
                    </button>
                    {highlighted && (
                      <button
                        className="wc-btn wc-btn--ghost wc-btn--sm"
                        onClick={() => onToggleHighlight(true)}
                      >
                        <CloseIcon fontSize="small" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="wc-modal__actions">
                <button className="wc-btn wc-btn--ghost" onClick={() => onListen(selected.text)}>
                  <VolumeUpIcon fontSize="small" /> Listen
                </button>
                <button className="wc-btn wc-btn--primary" onClick={onSaveTerm}>
                  <AddIcon fontSize="small" /> Save as term
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

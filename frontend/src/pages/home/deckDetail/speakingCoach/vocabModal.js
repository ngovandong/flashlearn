import React from "react";

import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import BorderColorIcon from "@mui/icons-material/BorderColor";

// Vocabulary coach popup shared by the Speaking Coach and Course lesson pages.
// Purely presentational: meaning / IPA / examples for a selected word or phrase,
// with callbacks to listen, save it as a term, and (optionally) highlight it.
//
//   selected: { text, context, loading, error, fields, explain }
//   showHighlightControls: render the note + highlight section when truthy
export default function VocabModal({
  selected,
  noteDraft,
  setNoteDraft,
  isHighlighted,
  showHighlightControls = false,
  onClose,
  onRetry,
  onSpeak,
  onSaveTerm,
  onToggleHighlight,
}) {
  if (!selected) return null;
  const highlighted = isHighlighted?.(selected.text);

  return (
    <div className="sc-modal" onClick={onClose}>
      <div className="sc-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="sc-modal__head">
          <div>
            <span className="sc-modal__eyebrow">Vocabulary coach</span>
            <h3>"{selected.text}"</h3>
          </div>
          <button className="sc-icon-btn sc-icon-btn--light" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </button>
        </div>

        <div className="sc-modal__body">
          {selected.loading ? (
            <div className="sc-modal__loading">
              <div className="sc-spinner" />
              <p>Looking it up…</p>
            </div>
          ) : selected.error ? (
            <div className="sc-modal__error">
              <p>{selected.error}</p>
              <button className="sc-btn sc-btn--ghost sc-btn--sm" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="sc-modal__meaning">
                <span className="sc-section-label">Meaning</span>
                <p>{selected.explain?.meaning || selected.fields?.definition || "—"}</p>
              </div>
              <div className="sc-grid-2">
                <div className="sc-modal__cell">
                  <span className="sc-section-label">Pronunciation</span>
                  <span className="sc-mono sc-mono--good">
                    {selected.fields?.pronunciation || "/--/"}
                  </span>
                </div>
                <div className="sc-modal__cell">
                  <span className="sc-section-label">Word type</span>
                  <span>{selected.fields?.word_type || "—"}</span>
                </div>
              </div>
              {selected.explain?.mouthTip && (
                <div className="sc-modal__cell">
                  <span className="sc-section-label">Speaking tip</span>
                  <p>{selected.explain.mouthTip}</p>
                </div>
              )}
              {selected.fields?.examples?.length > 0 && (
                <div className="sc-modal__cell">
                  <span className="sc-section-label">Example</span>
                  <p
                    className="sc-modal__example"
                    dangerouslySetInnerHTML={{ __html: selected.fields.examples[0] }}
                  />
                </div>
              )}
              {showHighlightControls && (
                <div className="sc-modal__note">
                  <span className="sc-section-label">Note (optional)</span>
                  <input
                    type="text"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Add a quick note for this highlight…"
                  />
                  <div className="sc-modal__note-actions">
                    <button
                      className={`sc-btn sc-btn--sm ${
                        highlighted ? "sc-btn--primary" : "sc-btn--ghost"
                      }`}
                      onClick={() => onToggleHighlight(false)}
                    >
                      <BorderColorIcon fontSize="small" />
                      {highlighted ? "Update highlight" : "Highlight in chat"}
                    </button>
                    {highlighted && (
                      <button
                        className="sc-btn sc-btn--ghost sc-btn--sm"
                        onClick={() => onToggleHighlight(true)}
                      >
                        <CloseIcon fontSize="small" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="sc-modal__actions">
                <button className="sc-btn sc-btn--ghost" onClick={() => onSpeak(selected.text)}>
                  <VolumeUpIcon fontSize="small" /> Listen
                </button>
                <button className="sc-btn sc-btn--primary" onClick={onSaveTerm}>
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

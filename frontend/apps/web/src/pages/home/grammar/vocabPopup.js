import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import BorderColorIcon from "@mui/icons-material/BorderColor";

// Popup for a word/phrase the user selected in a grammar unit. Shows the AI
// meaning/pronunciation and lets them highlight the phrase on this unit or save
// it as a term in their default deck. Mirrors the Writing Coach's VocabModal.
export default function VocabPopup({
  selected,
  isHighlighted,
  noteDraft,
  onNoteChange,
  onClose,
  onRetry,
  onListen,
  onToggleHighlight,
  onSaveTerm,
  saving,
}) {
  if (!selected) return null;
  const highlighted = isHighlighted(selected.text);
  return (
    <div className="gr-modal" onClick={onClose}>
      <div className="gr-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="gr-modal__head">
          <div>
            <span className="gr-modal__eyebrow">Vocabulary</span>
            <h3>"{selected.text}"</h3>
          </div>
          <button className="gr-modal__close" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </button>
        </div>

        <div className="gr-modal__body">
          {selected.loading ? (
            <div className="gr-modal__loading">
              <div className="sc-spinner" />
              <p>Looking it up…</p>
            </div>
          ) : selected.error ? (
            <div className="gr-modal__error">
              <p>{selected.error}</p>
              <button className="sc-btn sc-btn--ghost" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="gr-modal__cell">
                <span className="gr-modal__label">Meaning</span>
                <p>{selected.fields?.definition || "—"}</p>
              </div>
              <div className="gr-modal__grid">
                <div className="gr-modal__cell">
                  <span className="gr-modal__label">Pronunciation</span>
                  <span className="gr-modal__mono">{selected.fields?.pronunciation || "/--/"}</span>
                </div>
                <div className="gr-modal__cell">
                  <span className="gr-modal__label">Word type</span>
                  <span>{selected.fields?.word_type || "—"}</span>
                </div>
              </div>
              {selected.fields?.examples?.length > 0 && (
                <div className="gr-modal__cell">
                  <span className="gr-modal__label">Example</span>
                  <p
                    className="gr-modal__example"
                    dangerouslySetInnerHTML={{ __html: selected.fields.examples[0] }}
                  />
                </div>
              )}

              <div className="gr-modal__note">
                <span className="gr-modal__label">Note (optional)</span>
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => onNoteChange(e.target.value)}
                  placeholder="Add a quick note for this highlight…"
                />
                <div className="gr-modal__note-actions">
                  <button
                    className={`sc-btn ${highlighted ? "sc-btn--primary" : "sc-btn--ghost"}`}
                    onClick={() => onToggleHighlight(false)}
                  >
                    <BorderColorIcon fontSize="small" />
                    {highlighted ? "Update highlight" : "Highlight here"}
                  </button>
                  {highlighted && (
                    <button className="sc-btn sc-btn--ghost" onClick={() => onToggleHighlight(true)}>
                      <CloseIcon fontSize="small" /> Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="gr-modal__actions">
                <button className="sc-btn sc-btn--ghost" onClick={() => onListen(selected.text)}>
                  <VolumeUpIcon fontSize="small" /> Listen
                </button>
                <button className="sc-btn sc-btn--primary" onClick={onSaveTerm} disabled={saving}>
                  <AddIcon fontSize="small" /> {saving ? "Saving…" : "Save to deck"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

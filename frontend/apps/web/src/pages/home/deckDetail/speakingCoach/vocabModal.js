import React, { useEffect, useState } from "react";

import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineRounded";

import { getImagesURL } from "@api-services/crawlerService";

// Vocabulary coach popup shared by the Speaking Coach and Course lesson pages.
// It shows the meaning / IPA / speaking tip from explain_phrase (no enrichment),
// lets the learner listen, highlight (with a note), and save the word as a term
// after optionally picking a related image. The save-flow UI state is owned here
// since it's purely presentational; the parent supplies the data callbacks.
//
//   selected: { text, context, loading, error, explain }
//   highlighted: boolean — is this word currently highlighted
//   termMatch: { term_id, deck_id, name } | null — saved-term match for this word
//   showHighlightControls: render the note + highlight section when truthy
//   onSaveTerm(imageUrl) -> Promise<boolean>  (false keeps the panel open)
//   onToggleHighlight(remove), onOpenTerm(match), onRemoveTerm(match)
export default function VocabModal({
  selected,
  noteDraft,
  setNoteDraft,
  highlighted = false,
  termMatch = null,
  showHighlightControls = false,
  onClose,
  onRetry,
  onSpeak,
  onSaveTerm,
  onToggleHighlight,
  onOpenTerm,
  onRemoveTerm,
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");
  const [saving, setSaving] = useState(false);

  const text = selected?.text;
  // Reset the per-word save flow whenever a different word is opened.
  useEffect(() => {
    setSaveOpen(false);
    setImages([]);
    setImagesLoading(false);
    setSelectedImage("");
    setSaving(false);
  }, [text]);

  if (!selected) return null;

  // Lazily crawl related images the first time the save panel is opened.
  const openSavePanel = () => {
    setSaveOpen(true);
    if (!text || images.length || imagesLoading) return;
    setImagesLoading(true);
    getImagesURL(text)
      .then((res) => setImages(res.data?.urls || []))
      .catch(() => setImages([]))
      .finally(() => setImagesLoading(false));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onSaveTerm?.(selectedImage || "");
    setSaving(false);
    if (ok !== false) {
      setSaveOpen(false);
      setSelectedImage("");
    }
  };

  return (
    <div className="sc-modal" onClick={onClose}>
      <div className="sc-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="sc-modal__head">
          <div className="sc-modal__head-text">
            <span className="sc-modal__eyebrow">Vocabulary coach</span>
            <h3>"{selected.text}"</h3>
            {(highlighted || termMatch) && (
              <div className="sc-modal__chips">
                {highlighted && (
                  <span className="sc-modal__chip">
                    <BorderColorIcon fontSize="inherit" /> Highlighted
                  </span>
                )}
                {termMatch && (
                  <span className="sc-modal__chip sc-modal__chip--term">
                    <BookmarkAddedIcon fontSize="inherit" /> In your deck
                  </span>
                )}
              </div>
            )}
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
                <p>{selected.explain?.meaning || "—"}</p>
              </div>
              {(selected.explain?.ipaExplanation || selected.explain?.mouthTip) && (
                <div className="sc-grid-2">
                  {selected.explain?.ipaExplanation && (
                    <div className="sc-modal__cell">
                      <span className="sc-section-label">Pronunciation</span>
                      <p>{selected.explain.ipaExplanation}</p>
                    </div>
                  )}
                  {selected.explain?.mouthTip && (
                    <div className="sc-modal__cell">
                      <span className="sc-section-label">Speaking tip</span>
                      <p>{selected.explain.mouthTip}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                className="sc-btn sc-btn--ghost sc-modal__listen"
                onClick={() => onSpeak(selected.text)}
              >
                <VolumeUpIcon fontSize="small" /> Listen
              </button>

              {showHighlightControls && (
                <div className="sc-modal__note">
                  <span className="sc-section-label sc-section-label--row">
                    <BorderColorIcon fontSize="inherit" /> Highlight in chat
                  </span>
                  <input
                    type="text"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Add a quick note (optional)…"
                  />
                  <div className="sc-modal__note-actions">
                    <button
                      className={`sc-btn sc-btn--sm ${
                        highlighted ? "sc-btn--ghost" : "sc-btn--primary"
                      }`}
                      onClick={() => onToggleHighlight(false)}
                    >
                      <BorderColorIcon fontSize="small" />
                      {highlighted ? "Update note" : "Highlight"}
                    </button>
                    {highlighted && (
                      <button
                        className="sc-btn sc-btn--ghost sc-btn--sm"
                        onClick={() => onToggleHighlight(true)}
                      >
                        <CloseIcon fontSize="small" /> Unhighlight
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="sc-modal__save">
                {termMatch ? (
                  <>
                    <span className="sc-section-label sc-section-label--row">
                      <BookmarkAddedIcon fontSize="inherit" /> Saved in your deck
                    </span>
                    <div className="sc-modal__save-actions">
                      <button
                        className="sc-btn sc-btn--primary sc-btn--sm"
                        onClick={() => onOpenTerm?.(termMatch)}
                      >
                        <OpenInNewIcon fontSize="small" /> Open to study
                      </button>
                      <button
                        className="sc-btn sc-btn--ghost sc-btn--sm"
                        onClick={() => onRemoveTerm?.(termMatch)}
                      >
                        <DeleteOutlineIcon fontSize="small" /> Remove
                      </button>
                    </div>
                  </>
                ) : saveOpen ? (
                  <>
                    <span className="sc-section-label sc-section-label--row">
                      <ImageOutlinedIcon fontSize="inherit" /> Pick an image (optional)
                    </span>
                    <div className="sc-img-grid">
                      {imagesLoading && (
                        <div className="sc-img-grid__status">
                          <div className="sc-spinner" />
                          <span>Finding images…</span>
                        </div>
                      )}
                      {!imagesLoading && images.length === 0 && (
                        <p className="sc-img-grid__status">
                          No images found — you can still save without one.
                        </p>
                      )}
                      {!imagesLoading &&
                        images.map((url) => (
                          <button
                            type="button"
                            key={url}
                            className={`sc-img-grid__item ${
                              selectedImage === url ? "is-selected" : ""
                            }`}
                            onClick={() =>
                              setSelectedImage((cur) => (cur === url ? "" : url))
                            }
                          >
                            <img src={url} alt="" loading="lazy" />
                            {selectedImage === url && (
                              <span className="sc-img-grid__check">
                                <CheckCircleIcon fontSize="small" />
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                    <div className="sc-modal__save-actions">
                      <button
                        className="sc-btn sc-btn--primary sc-btn--sm"
                        disabled={saving}
                        onClick={handleSave}
                      >
                        <AddIcon fontSize="small" />
                        {saving ? "Saving…" : "Save to deck"}
                      </button>
                      <button
                        className="sc-btn sc-btn--ghost sc-btn--sm"
                        onClick={() => {
                          setSaveOpen(false);
                          setSelectedImage("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="sc-btn sc-btn--primary sc-modal__save-cta"
                    onClick={openSavePanel}
                  >
                    <AddIcon fontSize="small" /> Save as term
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

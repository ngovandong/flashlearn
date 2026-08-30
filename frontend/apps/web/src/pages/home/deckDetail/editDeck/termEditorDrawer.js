import {
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  TextField,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import TranslateIcon from "@mui/icons-material/Translate";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineRounded";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useEffect, useState } from "react";
import { termService } from "@api-services/termService";
import { getImagesURL, translateEnToVI } from "@api-services/crawlerService";
import { getFirstError } from "@utils/errorHandler";
import AiFillDialog from "@components/aiFillDialog";

const EMPTY_TERM = {
  name: "",
  meaning: "",
  image: "",
  word_type: "",
  pronunciation: "",
  definition: "",
  synonyms: [],
  antonyms: [],
  examples: [],
  word_forms: [],
  word_family: [],
  ai_filled: false,
};

const previewSrc = (image) => {
  if (!image) return null;
  return typeof image === "object" ? URL.createObjectURL(image) : image;
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "0.75rem",
    backgroundColor: "var(--fl-surface-2)",
  },
};

/**
 * Full editor for a single term. A right-hand panel on desktop, a bottom sheet on
 * phones. Each confirm writes straight to the API, so there is no page-wide
 * unsaved state to lose while paging through a large deck.
 */
function TermEditorDrawer({ open, deckID, term, onClose, onSaved, onError }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [draft, setDraft] = useState(EMPTY_TERM);
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const isNew = !draft.id;

  useEffect(() => {
    if (open) {
      setDraft({ ...EMPTY_TERM, ...(term || {}) });
      setImages([]);
      setNameError(null);
    }
  }, [open, term]);

  const setField = (key) => (event) =>
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  const fetchImages = async () => {
    if (!draft.name.trim() || imagesLoading) return;
    setImagesLoading(true);
    try {
      const res = await getImagesURL(draft.name.trim());
      setImages(res.data.urls || []);
    } catch (error) {
      setImages([]);
      onError("Couldn't load images. Please try again.");
    } finally {
      setImagesLoading(false);
    }
  };

  const translate = async () => {
    if (!draft.name.trim() || translating) return;
    setTranslating(true);
    try {
      const res = await translateEnToVI(draft.name.trim());
      setDraft((prev) => ({ ...prev, meaning: res.data }));
    } catch (error) {
      onError("Couldn't translate this term. Please try again.");
    } finally {
      setTranslating(false);
    }
  };

  const save = async (addAnother = false) => {
    const name = draft.name.trim();
    if (!name) {
      setNameError("Please enter the term.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...draft, name, meaning: draft.meaning ?? "" };
      const res = draft.id
        ? await termService.updateTerms([payload])
        : await termService.addTermsToDeck(deckID, [payload]);
      if (res.error) {
        onError(getFirstError(res.error));
        return;
      }
      onSaved(draft.id ? "Term updated" : "Term added");
      if (addAnother) {
        setDraft(EMPTY_TERM);
        setImages([]);
      } else {
        onClose();
      }
    } catch (error) {
      onError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const preview = previewSrc(draft.image);
  const aiChips = [
    draft.word_type,
    draft.pronunciation,
    draft.synonyms?.length ? `${draft.synonyms.length} synonyms` : null,
    draft.examples?.length ? `${draft.examples.length} examples` : null,
  ].filter(Boolean);

  return (
    <Drawer
      anchor={isMobile ? "bottom" : "right"}
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          className: "term-editor",
          sx: {
            width: { xs: "100%", sm: 480 },
            maxWidth: "100%",
            height: { xs: "88vh", sm: "100%" },
            borderTopLeftRadius: { xs: "1.25rem", sm: 0 },
            borderTopRightRadius: "1.25rem",
            borderBottomLeftRadius: { xs: 0, sm: 0 },
            backgroundColor: "var(--fl-surface)",
            backgroundImage: "none",
            borderLeft: { sm: "1px solid var(--fl-border)" },
          },
        },
        backdrop: { sx: { backgroundColor: "rgba(15, 18, 28, 0.45)" } },
      }}
    >
      <header className="term-editor__header">
        <div>
          <span className="term-editor__eyebrow">
            {isNew ? "New term" : "Editing"}
          </span>
          <h3>{isNew ? "Add a term" : draft.name || "Edit term"}</h3>
        </div>
        <IconButton onClick={onClose} size="small" aria-label="Close editor">
          <CloseIcon />
        </IconButton>
      </header>

      <div className="term-editor__body">
        <section className="term-editor__section">
          <TextField
            label="Term"
            value={draft.name}
            onChange={(e) => {
              setNameError(null);
              setField("name")(e);
            }}
            error={!!nameError}
            helperText={nameError}
            fullWidth
            autoFocus
            size="small"
            sx={fieldSx}
          />
          <TextField
            label="Meaning"
            value={draft.meaning ?? ""}
            onChange={setField("meaning")}
            fullWidth
            multiline
            minRows={2}
            size="small"
            sx={fieldSx}
          />

          <div className="term-editor__actions">
            <Button
              size="small"
              variant="outlined"
              startIcon={<TranslateIcon />}
              onClick={translate}
              disabled={!draft.name.trim() || translating}
            >
              Translate
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoFixHighIcon />}
              onClick={() => setAiOpen(true)}
              disabled={!draft.name.trim()}
            >
              {draft.ai_filled ? "AI data" : "Fill with AI"}
            </Button>
          </div>

          {aiChips.length > 0 && (
            <div className="term-editor__chips">
              {aiChips.map((chip) => (
                <Chip key={chip} label={chip} size="small" variant="outlined" />
              ))}
            </div>
          )}
        </section>

        <section className="term-editor__section">
          <div className="term-editor__section-head">
            <h4>Picture</h4>
            <Button
              size="small"
              startIcon={<ImageSearchIcon />}
              onClick={fetchImages}
              disabled={!draft.name.trim() || imagesLoading}
            >
              Find images
            </Button>
          </div>

          {preview ? (
            <div className="term-editor__preview">
              <img src={preview} alt={draft.name} />
              <Tooltip title="Remove image">
                <IconButton
                  size="small"
                  className="term-editor__preview-remove"
                  onClick={() => setDraft((prev) => ({ ...prev, image: "" }))}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
          ) : (
            <p className="term-editor__hint">
              No picture yet — search the web or upload your own.
            </p>
          )}

          {imagesLoading && (
            <div className="term-editor__loading">
              <CircularProgress size={22} />
            </div>
          )}
          {!imagesLoading && images.length > 0 && (
            <div className="term-editor__results">
              {images.map((url) => (
                <button
                  type="button"
                  key={url}
                  className={draft.image === url ? "selected" : ""}
                  onClick={() => setDraft((prev) => ({ ...prev, image: url }))}
                >
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          )}

          <div className="term-editor__upload">
            <input
              type="file"
              accept="image/*"
              id={`term-image-${draft.id || "new"}`}
              onChange={(e) =>
                e.target.files[0] &&
                setDraft((prev) => ({ ...prev, image: e.target.files[0] }))
              }
            />
            <label htmlFor={`term-image-${draft.id || "new"}`}>
              <CloudUploadIcon fontSize="small" />
              Upload from this device
            </label>
          </div>
        </section>
      </div>

      <footer className="term-editor__footer">
        <Button onClick={onClose} disabled={saving} color="inherit">
          Cancel
        </Button>
        {isNew && (
          <Button onClick={() => save(true)} disabled={saving}>
            Save & add another
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => save(false)}
          disabled={saving}
          sx={{
            borderRadius: "999px",
            paddingInline: "1.5rem",
            background: "var(--fl-gradient)",
            color: "var(--fl-on-primary)",
          }}
        >
          {saving ? "Saving…" : isNew ? "Add term" : "Save"}
        </Button>
      </footer>

      <AiFillDialog
        open={aiOpen}
        name={draft.name}
        meaning={draft.meaning}
        initial={draft}
        onClose={() => setAiOpen(false)}
        onApply={(fields) => setDraft((prev) => ({ ...prev, ...fields }))}
      />
    </Drawer>
  );
}

export default TermEditorDrawer;

import { useState } from "react";
import {
  Button,
  Chip,
  Collapse,
  MenuItem,
  TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import PublicIcon from "@mui/icons-material/Public";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";

const SAVE_BTN_SX = {
  borderRadius: "999px",
  paddingInline: "1.5rem",
  textTransform: "none",
  fontWeight: 700,
  boxShadow: "none",
  background: "var(--fl-gradient)",
  color: "var(--fl-on-primary)",
  "&.Mui-disabled": {
    background: "var(--fl-surface-2)",
    color: "var(--fl-text-muted)",
  },
};

const coverSrc = (background) => {
  if (!background) return "imgs/placeholder.png";
  return typeof background === "string"
    ? background
    : URL.createObjectURL(background);
};

/**
 * The deck's own settings — name, description, visibility and cover.
 *
 * Collapsed by default: on the merged editor the terms are the main job, and
 * the closed header already summarises everything this panel edits. Saving is
 * explicit here (unlike terms, which save per action) because a half-typed
 * name shouldn't reach the server.
 */
function DeckDetailsPanel({ deck, setDeck, onSave, isSaving, isDirty, justSaved }) {
  const [open, setOpen] = useState(false);

  const update = (field) => (event) =>
    setDeck((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <section className="deck-details" data-tour="deck-details">
      <button
        type="button"
        className="deck-details__head"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <img className="deck-details__thumb" src={coverSrc(deck.background)} alt="" />
        <span className="deck-details__summary">
          <span className="deck-details__eyebrow">Deck details</span>
          <strong className="deck-details__name">
            {deck.name || "Untitled deck"}
          </strong>
          <span className="deck-details__description">
            {deck.description || "No description yet"}
          </span>
        </span>
        <Chip
          size="small"
          className="deck-details__chip"
          icon={deck.is_public ? <PublicIcon /> : <LockOutlinedIcon />}
          label={deck.is_public ? "Everyone" : "Only me"}
        />
        {isDirty && <span className="deck-details__dot" title="Unsaved changes" />}
        <ExpandMoreIcon
          className={`deck-details__chevron${open ? " deck-details__chevron--open" : ""}`}
        />
      </button>

      <Collapse in={open} unmountOnExit>
        <div className="deck-details__body">
          <div className="deck-details__cover">
            <img src={coverSrc(deck.background)} alt="Deck cover" />
            <input
              type="file"
              accept="image/*"
              id="deck-cover"
              onChange={(e) =>
                e.target.files[0] &&
                setDeck((prev) => ({ ...prev, background: e.target.files[0] }))
              }
            />
            <label htmlFor="deck-cover">
              <PhotoCameraOutlinedIcon fontSize="small" />
              Change cover
            </label>
          </div>

          <div className="deck-details__fields">
            <TextField
              label="Title"
              size="small"
              fullWidth
              value={deck.name}
              onChange={update("name")}
            />
            <TextField
              label="Description"
              size="small"
              fullWidth
              multiline
              minRows={3}
              value={deck.description}
              onChange={update("description")}
            />
            <TextField
              select
              size="small"
              label="Who can view"
              value={deck.is_public}
              onChange={(e) =>
                setDeck((prev) => ({ ...prev, is_public: e.target.value }))
              }
            >
              <MenuItem value={false}>Only me</MenuItem>
              <MenuItem value={true}>Everyone</MenuItem>
            </TextField>
          </div>
        </div>

        <div className="deck-details__footer">
          <span className="deck-details__status">
            {isDirty ? (
              "Unsaved changes"
            ) : justSaved ? (
              <>
                <CheckCircleOutlineIcon fontSize="small" />
                Saved
              </>
            ) : (
              "Everything is up to date"
            )}
          </span>
          <Button
            variant="contained"
            sx={SAVE_BTN_SX}
            disabled={!isDirty || isSaving}
            onClick={onSave}
          >
            Save details
          </Button>
        </div>
      </Collapse>
    </section>
  );
}

export default DeckDetailsPanel;

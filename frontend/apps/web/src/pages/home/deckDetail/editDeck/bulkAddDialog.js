import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { termService } from "@api-services/termService";
import { getFirstError } from "@utils/errorHandler";
import { countSkippedTermLines, parseTermLines } from "@utils/termText";

const PLACEHOLDER = "irrelevant - không liên quan\nflickering = nhấp nháy\nhouse,ngôi nhà";

/** Paste a whole list of terms at once instead of filling one form per word. */
function BulkAddDialog({ open, deckID, onClose, onSaved, onError }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = parseTermLines(text);
  const skipped = countSkippedTermLines(text);

  const close = () => {
    setText("");
    onClose();
  };

  const save = async () => {
    if (parsed.length === 0) return;
    setSaving(true);
    try {
      const res = await termService.addTermsToDeck(deckID, parsed);
      if (res.error) {
        onError(getFirstError(res.error));
        return;
      }
      onSaved(`${parsed.length} term${parsed.length > 1 ? "s" : ""} added`);
      close();
    } catch (error) {
      onError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: "1rem" } } }}
    >
      <DialogTitle>Add many terms</DialogTitle>
      <DialogContent dividers>
        <p className="bulk-dialog__hint">
          One term per line, written as <code>term - meaning</code>. An equals
          sign, comma or tab works too.
        </p>
        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          multiline
          minRows={8}
          fullWidth
          autoFocus
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: "0.75rem" } }}
        />
        <p className="bulk-dialog__count">
          {parsed.length} term{parsed.length === 1 ? "" : "s"} ready
          {skipped > 0 &&
            ` · ${skipped} duplicate or empty line${skipped === 1 ? "" : "s"} skipped`}
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={saving} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving || parsed.length === 0}
          sx={{
            borderRadius: "999px",
            paddingInline: "1.5rem",
            textTransform: "none",
            background: "var(--fl-gradient)",
            color: "var(--fl-on-primary)",
          }}
        >
          {saving ? "Adding…" : `Add ${parsed.length || ""} terms`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BulkAddDialog;

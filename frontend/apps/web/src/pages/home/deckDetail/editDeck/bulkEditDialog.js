import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { termService } from "@api-services/termService";
import { getFirstError } from "@utils/errorHandler";
import { formatTermLines, parseTermLines } from "@utils/termText";

/**
 * Rewrite the selected terms as text — the fastest way to fix a batch of typos
 * or fill in missing meanings. Lines stay matched to rows by position, so the
 * line count has to stay the same.
 */
function BulkEditDialog({ open, terms, onClose, onSaved, onError }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setText(formatTermLines(terms));
  }, [open, terms]);

  const parsed = parseTermLines(text, { dedupe: false });
  const mismatch = parsed.length !== terms.length;

  const save = async () => {
    if (mismatch) return;
    setSaving(true);
    try {
      const payload = terms.map((term, index) => ({
        ...term,
        name: parsed[index].name,
        meaning: parsed[index].meaning,
      }));
      const res = await termService.updateTerms(payload);
      if (res.error) {
        onError(getFirstError(res.error));
        return;
      }
      onSaved(`${payload.length} term${payload.length > 1 ? "s" : ""} updated`);
      onClose();
    } catch (error) {
      onError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: "1rem" } } }}
    >
      <DialogTitle>Edit {terms.length} terms as text</DialogTitle>
      <DialogContent dividers>
        <p className="bulk-dialog__hint">
          One term per line, written as <code>term = meaning</code>. Keep every
          line — deleting one here won't delete the term.
        </p>
        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          multiline
          minRows={8}
          fullWidth
          autoFocus
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: "0.75rem" } }}
        />
        {mismatch && (
          <Alert severity="warning" sx={{ marginTop: "0.75rem" }}>
            Expected {terms.length} lines but found {parsed.length}. Add or remove
            lines so each selected term has exactly one.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving || mismatch}
          sx={{
            borderRadius: "999px",
            paddingInline: "1.5rem",
            textTransform: "none",
            background: "var(--fl-gradient)",
            color: "var(--fl-on-primary)",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BulkEditDialog;

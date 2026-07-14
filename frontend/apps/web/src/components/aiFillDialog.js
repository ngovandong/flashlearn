import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { useCallback, useEffect, useState } from "react";
import { termService } from "@api-services/termService";
import { getFirstError } from "@utils/errorHandler";

const toLines = (arr) => (Array.isArray(arr) ? arr.join("\n") : "");
const toCsv = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");
const fromCsv = (value) =>
  (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const fromLines = (value) =>
  (value || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const emptyFields = {
  word_type: "",
  pronunciation: "",
  definition: "",
  synonyms: "",
  antonyms: "",
  examples: "",
  word_forms: "",
  word_family: "",
};

// Reusable dialog that asks the backend to generate Oxford-style data for a
// term, lets the user edit it, and returns the result via onApply.
export default function AiFillDialog({ open, name, meaning, initial, onClose, onApply }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState(emptyFields);

  const setField = (key) => (e) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const generate = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const res = await termService.aiEnrich(name, meaning || "");
      if (res.error) {
        setError(getFirstError(res.error));
      } else {
        const d = res.data || {};
        setFields({
          word_type: d.word_type || "",
          pronunciation: d.pronunciation || "",
          definition: d.definition || "",
          synonyms: toCsv(d.synonyms),
          antonyms: toCsv(d.antonyms),
          examples: toLines(d.examples),
          word_forms: toLines(d.word_forms),
          word_family: toLines(d.word_family),
        });
      }
    } catch (err) {
      setError("AI request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [name, meaning]);

  useEffect(() => {
    if (!open) return;
    const hasInitial =
      initial &&
      (initial.definition ||
        initial.word_type ||
        (initial.examples && initial.examples.length));
    if (hasInitial) {
      setFields({
        word_type: initial.word_type || "",
        pronunciation: initial.pronunciation || "",
        definition: initial.definition || "",
        synonyms: toCsv(initial.synonyms),
        antonyms: toCsv(initial.antonyms),
        examples: toLines(initial.examples),
        word_forms: toLines(initial.word_forms),
        word_family: toLines(initial.word_family),
      });
    } else {
      generate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleApply = () => {
    onApply({
      word_type: fields.word_type.trim(),
      pronunciation: fields.pronunciation.trim(),
      definition: fields.definition.trim(),
      synonyms: fromCsv(fields.synonyms),
      antonyms: fromCsv(fields.antonyms),
      examples: fromLines(fields.examples),
      word_forms: fromLines(fields.word_forms),
      word_family: fromLines(fields.word_family),
      ai_filled: true,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Fill "{name}" with AI
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
            <CircularProgress />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {error && <div style={{ color: "#d32f2f" }}>{error}</div>}
            <TextField
              label="Type of word"
              size="small"
              value={fields.word_type}
              onChange={setField("word_type")}
              placeholder="Noun, verb, adjective…"
            />
            <TextField
              label="Pronunciation (IPA)"
              size="small"
              value={fields.pronunciation}
              onChange={setField("pronunciation")}
              placeholder="/ɔɪl/"
            />
            <TextField
              label="Definition (English)"
              size="small"
              multiline
              minRows={2}
              value={fields.definition}
              onChange={setField("definition")}
            />
            <TextField
              label="Synonyms (comma separated)"
              size="small"
              value={fields.synonyms}
              onChange={setField("synonyms")}
            />
            <TextField
              label="Antonyms (comma separated)"
              size="small"
              value={fields.antonyms}
              onChange={setField("antonyms")}
            />
            <TextField
              label="Word forms (one per line, e.g. past tense: ran)"
              size="small"
              multiline
              minRows={2}
              value={fields.word_forms}
              onChange={setField("word_forms")}
              placeholder={"present participle: running\npast tense: ran"}
            />
            <TextField
              label="Word family (one per line, e.g. noun: specification)"
              size="small"
              multiline
              minRows={2}
              value={fields.word_family}
              onChange={setField("word_family")}
              placeholder={"noun: specification\nadverb: specifically"}
            />
            <TextField
              label="Examples (one per line, wrap the main word in <b></b>)"
              size="small"
              multiline
              minRows={4}
              value={fields.examples}
              onChange={setField("examples")}
            />
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={generate} disabled={loading} startIcon={<AutoFixHighIcon />}>
          Regenerate
        </Button>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleApply} variant="contained" disabled={loading}>
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Pagination,
  TextField,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Close";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import HideImageOutlinedIcon from "@mui/icons-material/HideImageOutlined";
import EditNoteIcon from "@mui/icons-material/EditNote";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { termService } from "@api-services/termService";
import { getImagesURL } from "@api-services/crawlerService";
import { getFirstError } from "@utils/errorHandler";
import { LocalLoadingWrapper } from "@components/loading";
import { TERM_EDIT_PAGE_SIZE } from "@constants/pageSize";
import { COLORS } from "@constants/colors";
import TermRow from "./termRow";
import TermEditorDrawer from "./termEditorDrawer";
import BulkAddDialog from "./bulkAddDialog";
import BulkEditDialog from "./bulkEditDialog";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "A → Z" },
  { value: "za", label: "Z → A" },
];

const SEARCH_DEBOUNCE_MS = 400;

// Shared MUI overrides — softer, rounder shapes than the defaults, all built on
// theme tokens so they follow the palette and dark mode.
const ROUND_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "999px",
    backgroundColor: "var(--fl-surface-2)",
  },
};

const PRIMARY_BTN_SX = {
  borderRadius: "999px",
  paddingInline: "1.25rem",
  textTransform: "none",
  fontWeight: 700,
  boxShadow: "none",
  background: "var(--fl-gradient)",
  color: "var(--fl-on-primary)",
  "&:hover": { boxShadow: "0 6px 18px rgba(var(--fl-primary-rgb), 0.32)" },
};

const GHOST_BTN_SX = {
  borderRadius: "999px",
  paddingInline: "1.25rem",
  textTransform: "none",
  fontWeight: 600,
  color: "var(--fl-text)",
  borderColor: "var(--fl-border-strong)",
  "&:hover": {
    borderColor: "var(--fl-primary)",
    backgroundColor: "rgba(var(--fl-primary-rgb), 0.06)",
  },
};

const ROUND_DIALOG_SLOT_PROPS = {
  paper: { sx: { borderRadius: "1rem", minWidth: { sm: "24rem" } } },
};

const BULK_BTN_SX = {
  borderRadius: "999px",
  textTransform: "none",
  fontWeight: 600,
  color: "var(--fl-text)",
  "&:hover": { backgroundColor: "rgba(var(--fl-primary-rgb), 0.1)" },
};

/**
 * The deck editor's term list.
 *
 * Built for big decks — terms are searched, sorted and paged server-side, edited
 * one at a time in a drawer, and changed in batches through the selection bar.
 * Every action saves immediately, so there is never a page-wide unsaved diff.
 * Messages bubble up to the page, which owns the single pair of snackbars.
 */
function TermManager({ onError: setError, onNotice: setNotice }) {
  const { deckID } = useParams();

  const [terms, setTerms] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [totalTerms, setTotalTerms] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  const [editing, setEditing] = useState(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const pageCount = Math.max(1, Math.ceil(matchCount / TERM_EDIT_PAGE_SIZE));
  const selectedTerms = useMemo(
    () => terms.filter((t) => selectedIds.includes(t.id)),
    [terms, selectedIds]
  );

  const loadTerms = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await termService.browseTerms(deckID, { q: query, sort, page });
      if (res.error) {
        setError(getFirstError(res.error));
        return;
      }
      setTerms(res.data.results);
      setMatchCount(res.data.count);
    } catch (err) {
      setError("Couldn't load this deck's terms. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [deckID, query, sort, page, setError]);

  const loadTotal = useCallback(async () => {
    const res = await termService.browseTerms(deckID, { page: 1, pageSize: 1 });
    if (!res.error) setTotalTerms(res.data.count);
  }, [deckID]);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  useEffect(() => {
    loadTotal();
  }, [loadTotal]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, query, sort]);

  const refresh = async () => {
    await Promise.all([loadTerms(), loadTotal()]);
  };

  const handleSaved = async (message) => {
    setNotice(message);
    setSelectedIds([]);
    await refresh();
  };

  const toggleSelect = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  const togglePageSelection = () =>
    setSelectedIds((prev) =>
      prev.length === terms.length ? [] : terms.map((t) => t.id)
    );

  const confirmDelete = async () => {
    const ids = pendingDelete.ids;
    setPendingDelete(null);
    setBusy(true);
    try {
      const res = await termService.bulkDelete(deckID, ids);
      if (res.error) {
        setError(getFirstError(res.error));
        return;
      }
      // Stepping back keeps the user on a page that still has rows.
      if (ids.length === terms.length && page > 1) setPage((p) => p - 1);
      setNotice(`${ids.length} term${ids.length > 1 ? "s" : ""} deleted`);
      setSelectedIds([]);
      await refresh();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Walk the selection one term at a time, showing progress, then save in one call. */
  const runBulkEnrichment = async (label, targets, enrich) => {
    if (targets.length === 0) {
      setNotice("Nothing to do — the selected terms already have this.");
      return;
    }
    setProgress({ label, done: 0, total: targets.length });
    const updated = [];
    try {
      for (const [index, term] of targets.entries()) {
        const fields = await enrich(term);
        if (fields) updated.push({ ...term, ...fields });
        setProgress({ label, done: index + 1, total: targets.length });
      }
      if (updated.length > 0) {
        const res = await termService.updateTerms(updated);
        if (res.error) {
          setError(getFirstError(res.error));
          return;
        }
      }
      setNotice(`${updated.length} of ${targets.length} terms updated`);
      setSelectedIds([]);
      await refresh();
    } catch (err) {
      setError("Something went wrong partway through. Please try again.");
    } finally {
      setProgress(null);
    }
  };

  const bulkAiFill = () =>
    runBulkEnrichment(
      "Filling with AI",
      selectedTerms.filter((t) => !t.ai_filled),
      async (term) => {
        const res = await termService.aiEnrich(term.name, term.meaning || "");
        return res.error ? null : { ...res.data, ai_filled: true };
      }
    );

  const bulkFindImages = () =>
    runBulkEnrichment(
      "Finding images",
      selectedTerms.filter((t) => !t.image),
      async (term) => {
        const res = await getImagesURL(term.name, 1);
        const url = res.data?.urls?.[0];
        return url ? { image: url } : null;
      }
    );

  const bulkClearImages = async () => {
    const targets = selectedTerms.filter((t) => t.image);
    if (targets.length === 0) {
      setNotice("None of the selected terms has an image.");
      return;
    }
    setBusy(true);
    try {
      const res = await termService.updateTerms(
        targets.map((t) => ({ ...t, image: "" }))
      );
      if (res.error) {
        setError(getFirstError(res.error));
        return;
      }
      await handleSaved(`Image removed from ${targets.length} terms`);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const isSearching = query.length > 0;
  const allPageSelected = terms.length > 0 && selectedIds.length === terms.length;

  return (
    <>
      <LocalLoadingWrapper open={busy} />

      <div className="term-manager">
        <div className="term-manager__toolbar">
          <TextField
            className="term-manager__search"
            data-tour="term-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms or meanings…"
            size="small"
            sx={ROUND_FIELD_SX}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "var(--fl-text-muted)" }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <TextField
            select
            size="small"
            className="term-manager__sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            sx={ROUND_FIELD_SX}
          >
            {SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <div className="term-manager__add">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              data-tour="term-add"
              onClick={() => setEditing({})}
              sx={PRIMARY_BTN_SX}
            >
              Add term
            </Button>
            <Button
              variant="outlined"
              startIcon={<PlaylistAddIcon />}
              data-tour="term-bulk-add"
              onClick={() => setBulkAddOpen(true)}
              sx={GHOST_BTN_SX}
            >
              Paste list
            </Button>
          </div>
        </div>

        <div className="term-manager__meta">
          <Checkbox
            size="small"
            checked={allPageSelected}
            indeterminate={selectedIds.length > 0 && !allPageSelected}
            onChange={togglePageSelection}
            disabled={terms.length === 0}
            inputProps={{ "aria-label": "Select every term on this page" }}
          />
          <span className="term-manager__count" data-tour="term-count">
            {isSearching
              ? `${matchCount} match${matchCount === 1 ? "" : "es"}`
              : `${totalTerms} term${totalTerms === 1 ? "" : "s"}`}
          </span>
          {isSearching && (
            <span className="term-manager__page-label">of {totalTerms}</span>
          )}
          {pageCount > 1 && (
            <span className="term-manager__page-label term-manager__page-label--end">
              Page {page} of {pageCount}
            </span>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="term-manager__selection" data-tour="term-selection">
            <span className="term-manager__selection-count">
              {selectedIds.length} selected
            </span>
            <div className="term-manager__selection-actions">
              <Tooltip title="Fill missing AI data (definition, examples, synonyms…)">
                <Button
                  size="small"
                  startIcon={<AutoFixHighIcon />}
                  onClick={bulkAiFill}
                  sx={BULK_BTN_SX}
                >
                  AI fill
                </Button>
              </Tooltip>
              <Tooltip title="Find an image for terms that have none">
                <Button
                  size="small"
                  startIcon={<ImageSearchIcon />}
                  onClick={bulkFindImages}
                  sx={BULK_BTN_SX}
                >
                  Find images
                </Button>
              </Tooltip>
              <Tooltip title="Remove the image from the selected terms">
                <Button
                  size="small"
                  startIcon={<HideImageOutlinedIcon />}
                  onClick={bulkClearImages}
                  sx={BULK_BTN_SX}
                >
                  Clear images
                </Button>
              </Tooltip>
              <Button
                size="small"
                startIcon={<EditNoteIcon />}
                onClick={() => setBulkEditOpen(true)}
                sx={BULK_BTN_SX}
              >
                Edit as text
              </Button>
              <Button
                size="small"
                startIcon={<DeleteOutlineIcon />}
                sx={{ ...BULK_BTN_SX, color: COLORS.ERROR_RED }}
                onClick={() =>
                  setPendingDelete({
                    ids: selectedIds,
                    label: `${selectedIds.length} selected term${
                      selectedIds.length > 1 ? "s" : ""
                    }`,
                  })
                }
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        <div
          key={`${query}-${sort}-${page}`}
          className={`term-manager__list${isLoading ? " term-manager__list--loading" : ""}`}
        >
          {terms.map((term, index) => (
            <TermRow
              key={term.id}
              term={term}
              position={(page - 1) * TERM_EDIT_PAGE_SIZE + index + 1}
              selected={selectedIds.includes(term.id)}
              onToggleSelect={toggleSelect}
              onEdit={setEditing}
              onDelete={(t) => setPendingDelete({ ids: [t.id], label: `"${t.name}"` })}
            />
          ))}

          {!isLoading && terms.length === 0 && (
            <div className="term-manager__empty">
              <span className="term-manager__empty-icon">
                {isSearching ? <SearchIcon /> : <PlaylistAddIcon />}
              </span>
              {isSearching ? (
                <>
                  <h4>No match for “{query}”</h4>
                  <p>Try a different word, or clear the search to see every term.</p>
                  <Button onClick={() => setSearch("")} sx={GHOST_BTN_SX} variant="outlined">
                    Clear search
                  </Button>
                </>
              ) : (
                <>
                  <h4>This deck has no terms yet</h4>
                  <p>Add them one at a time, or paste a whole list at once.</p>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setEditing({})}
                    sx={PRIMARY_BTN_SX}
                  >
                    Add your first term
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {pageCount > 1 && (
          <div className="term-manager__pagination">
            <Pagination
              count={pageCount}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              siblingCount={0}
              shape="rounded"
            />
          </div>
        )}
      </div>

      <TermEditorDrawer
        open={editing != null}
        deckID={deckID}
        term={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
        onError={setError}
      />
      <BulkAddDialog
        open={bulkAddOpen}
        deckID={deckID}
        onClose={() => setBulkAddOpen(false)}
        onSaved={handleSaved}
        onError={setError}
      />
      <BulkEditDialog
        open={bulkEditOpen}
        terms={selectedTerms}
        onClose={() => setBulkEditOpen(false)}
        onSaved={handleSaved}
        onError={setError}
      />

      <Dialog
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        slotProps={ROUND_DIALOG_SLOT_PROPS}
      >
        <DialogTitle>Delete {pendingDelete?.label}?</DialogTitle>
        <DialogContent>
          This can't be undone — the learning progress saved for these terms goes
          with them.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={{
              borderRadius: "999px",
              paddingInline: "1.5rem",
              textTransform: "none",
              backgroundColor: COLORS.ERROR_RED,
            }}
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={progress != null}
        disableEscapeKeyDown
        slotProps={ROUND_DIALOG_SLOT_PROPS}
      >
        <DialogTitle>{progress?.label}</DialogTitle>
        <DialogContent>
          <p className="term-manager__progress-text">
            {progress?.done} of {progress?.total} terms
          </p>
          <LinearProgress
            variant="determinate"
            value={progress ? (progress.done / progress.total) * 100 : 0}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TermManager;

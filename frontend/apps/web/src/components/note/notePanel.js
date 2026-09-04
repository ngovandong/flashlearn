import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_NOTE_DOC, noteToPlainText } from "@flashlearn/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import Collapse from "@mui/material/Collapse";
import { toast } from "react-toastify";

import noteService from "@api-services/noteService";

import { readNoteCollapsed, writeNoteCollapsed } from "./notePanelStorage";

// TipTap is a sizable dependency and most page views never open a note, so the
// editor is only fetched once the panel expands.
const NoteEditor = lazy(() => import("./noteEditor"));

// Long enough that a sentence isn't saved word by word, short enough that a
// user who navigates away almost never loses anything (a flush covers the rest).
const AUTOSAVE_DELAY = 800;

/**
 * A collapsible rich-text note attached to a lesson, exercise or coach session.
 *
 * Collapsed by default when there is nothing written, open when there is — so
 * the panel stays out of the way until it has something to say. A manual
 * collapse is remembered per target.
 */
export default function NotePanel({ targetType, targetKey, title = "", targetUrl = "", label = "My notes" }) {
  const queryClient = useQueryClient();
  const queryKey = ["note", targetType, targetKey];
  const enabled = Boolean(targetType && targetKey);

  const { data: note, isPending } = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      const res = await noteService.forTarget(targetType, targetKey);
      if (res.error) throw new Error("Could not load your note.");
      return res.data?.note ?? null;
    },
  });

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  // The document is only pushed into the editor when the target changes; while
  // the editor is mounted it owns the text and reports changes back up.
  const draftRef = useRef(null);
  const timerRef = useRef(null);
  // An image that is still uploading sits in the document under a temporary
  // local URL. Saving then would store a picture the server refuses to keep, so
  // the autosave waits the upload out.
  const uploadingRef = useRef(false);
  const hasNote = Boolean(note);

  // Decide the initial open state once the note has loaded, unless the user has
  // already expressed a preference for this target.
  const settledRef = useRef(false);
  useEffect(() => {
    settledRef.current = false;
    draftRef.current = null;
    setStatus("idle");
    setOpen(false);
  }, [targetType, targetKey]);

  useEffect(() => {
    if (isPending || settledRef.current || !enabled) return;
    settledRef.current = true;
    const stored = readNoteCollapsed(targetType, targetKey);
    setOpen(stored === null ? hasNote : !stored);
  }, [isPending, enabled, hasNote, targetType, targetKey]);

  const save = useCallback(
    async (content) => {
      setStatus("saving");
      try {
        const res = await noteService.save(targetType, targetKey, { content, title, targetUrl });
        if (res.error) throw new Error("save failed");
        queryClient.setQueryData(queryKey, res.data?.note ?? null);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    },
    // `queryKey` is derived from the two target props, which are in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, targetType, targetKey, title, targetUrl]
  );

  const commit = useCallback(() => {
    if (uploadingRef.current) {
      timerRef.current = setTimeout(commit, AUTOSAVE_DELAY);
      return;
    }
    timerRef.current = null;
    if (draftRef.current) save(draftRef.current);
  }, [save]);

  const flush = useCallback(() => {
    if (timerRef.current === null || uploadingRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (draftRef.current) save(draftRef.current);
  }, [save]);

  const handleChange = useCallback(
    (content) => {
      draftRef.current = content;
      setStatus("dirty");
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(commit, AUTOSAVE_DELAY);
    },
    [commit]
  );

  const handleUploadingChange = useCallback((uploading) => {
    uploadingRef.current = uploading;
    setStatus((current) => (uploading ? "uploading" : current === "uploading" ? "dirty" : current));
  }, []);

  // Nothing pending should survive leaving the page — a tab close, a route
  // change or collapsing the panel all commit the outstanding edit.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  const toggle = () => {
    const next = !open;
    if (!next) flush();
    setOpen(next);
    writeNoteCollapsed(targetType, targetKey, !next);
  };

  const remove = async () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    draftRef.current = null;
    const res = await noteService.save(targetType, targetKey, { content: EMPTY_NOTE_DOC, title, targetUrl });
    if (res.error) {
      toast.error("Could not delete this note.");
      return;
    }
    queryClient.setQueryData(queryKey, null);
    setStatus("idle");
    setOpen(false);
  };

  if (!enabled) return null;

  const preview = hasNote ? noteToPlainText(note.content).replace(/\n+/g, " · ") : "";

  return (
    <section className={`note-panel${open ? " note-panel--open" : ""}`} data-tour="note-panel">
      <button
        type="button"
        className="note-panel__head"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`note-body-${targetType}-${targetKey}`}
      >
        <span className="note-panel__title">
          <StickyNote2Icon fontSize="small" />
          {hasNote || open ? label : "Add a note"}
        </span>
        {!open && preview ? <span className="note-panel__preview">{preview}</span> : null}
        <span className="note-panel__status">{open ? <SaveStatus status={status} /> : null}</span>
        <ExpandMoreIcon className="note-panel__chevron" fontSize="small" />
      </button>

      <Collapse in={open} unmountOnExit>
        <div className="note-panel__body" id={`note-body-${targetType}-${targetKey}`}>
          <Suspense fallback={<p className="note-panel__loading">Loading editor…</p>}>
            <NoteEditor
              key={`${targetType}:${targetKey}`}
              content={note?.content ?? EMPTY_NOTE_DOC}
              autoFocus={!hasNote}
              onChange={handleChange}
              onUploadingChange={handleUploadingChange}
              onError={toast.error}
            />
          </Suspense>
          <div className="note-panel__foot">
            <span className="note-panel__hint">Saves automatically. Paste or drop an image to add it.</span>
            {hasNote ? (
              <button type="button" className="note-panel__delete" onClick={remove}>
                <DeleteOutlineIcon fontSize="small" /> Delete note
              </button>
            ) : null}
          </div>
        </div>
      </Collapse>
    </section>
  );
}

function SaveStatus({ status }) {
  if (status === "uploading") return <>Adding image…</>;
  if (status === "saving") return <>Saving…</>;
  if (status === "saved") return <>Saved</>;
  if (status === "error") return <span className="note-panel__status--error">Not saved — retrying on next edit</span>;
  return null;
}

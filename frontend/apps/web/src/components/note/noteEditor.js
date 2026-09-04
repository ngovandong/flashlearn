import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";

import { buildNoteExtensions } from "./noteExtensions";
import { noteImageHandlers, useNoteImageUploads } from "./noteImages";
import NoteToolbar from "./noteToolbar";

const PLACEHOLDER = "Write what you want to remember — a rule, a phrase, a mistake to avoid…";

/**
 * The rich-text surface. Lazily imported by `NotePanel` so TipTap only reaches
 * the browser once someone actually opens a note.
 *
 * The editor owns the document while it is mounted: `content` seeds it and is
 * not re-applied on every keystroke, which is what keeps the caret stable.
 */
export default function NoteEditor({
  content,
  editable = true,
  autoFocus = false,
  onChange,
  onUploadingChange,
  onError,
}) {
  const editor = useEditor({
    extensions: buildNoteExtensions(PLACEHOLDER),
    content,
    editable,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor: instance }) => onChange?.(instance.getJSON()),
    editorProps: {
      attributes: { class: "note-editor__body", "aria-label": "Note" },
      ...noteImageHandlers,
    },
  });

  useNoteImageUploads(editor, { initialContent: content, onBusyChange: onUploadingChange, onError });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;

  return (
    <div className="note-editor">
      {editable ? <NoteToolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

import { useCallback, useEffect, useRef } from "react";

import noteService from "../../api-service/noteService";

/**
 * Keeps every image in the editor pointing at a picture we host.
 *
 * A note is only stored with images on our own CDN, so anything that arrives by
 * paste or drop has to be uploaded before it is saved. Rather than special-case
 * each way an image can appear, both handlers below drop a temporary local URL
 * into the document and a single pass swaps it for the hosted one once the
 * upload lands. Pasting a picture copied off a web page works the same way —
 * the server re-hosts the address it was copied from.
 */

const LOCAL_SCHEMES = ["blob:", "data:"];

const isLocal = (src) => LOCAL_SCHEMES.some((scheme) => src.startsWith(scheme));

/** Every image URL in a stored document. These already come from our CDN. */
function hostedSrcsIn(node, found = new Set()) {
  if (!node || typeof node !== "object") return found;
  if (node.type === "image" && node.attrs?.src) found.add(node.attrs.src);
  (node.content || []).forEach((child) => hostedSrcsIn(child, found));
  return found;
}

function imagePositions(editor, src) {
  const positions = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.src === src) positions.push({ node, pos });
  });
  return positions;
}

function rewriteSrc(editor, from, to) {
  const { tr } = editor.state;
  imagePositions(editor, from).forEach(({ node, pos }) => {
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: to });
  });
  // Outside the undo stack: undo should step back through what was typed, not
  // through an upload finishing.
  if (tr.docChanged) editor.view.dispatch(tr.setMeta("addToHistory", false));
}

function dropImages(editor, src) {
  const { tr } = editor.state;
  // Back to front, so earlier deletions do not shift later positions.
  imagePositions(editor, src)
    .reverse()
    .forEach(({ node, pos }) => tr.delete(pos, pos + node.nodeSize));
  if (tr.docChanged) editor.view.dispatch(tr);
}

/**
 * Watches the document for images we do not host yet and uploads them.
 *
 * Reports through `onBusyChange` while any upload is in flight so the panel can
 * hold off saving — a document saved mid-upload would come back with the
 * unfinished images stripped out.
 */
export function useNoteImageUploads(editor, { initialContent, onBusyChange, onError }) {
  const hosted = useRef(null);
  const pending = useRef(new Set());

  if (hosted.current === null) hosted.current = hostedSrcsIn(initialContent);

  const setBusy = useCallback(() => onBusyChange?.(pending.current.size > 0), [onBusyChange]);

  const upload = useCallback(
    async (src) => {
      pending.current.add(src);
      setBusy();
      try {
        // Local URLs hold the bytes themselves; a remote one is re-hosted by
        // the server, which keeps a copied-from-the-web image from breaking.
        const source = isLocal(src) ? await (await fetch(src)).blob() : src;
        const { data } = await noteService.uploadImage(source);
        hosted.current.add(data.url);
        rewriteSrc(editor, src, data.url);
      } catch {
        dropImages(editor, src);
        onError?.("That image couldn't be added.");
      } finally {
        if (isLocal(src)) URL.revokeObjectURL(src);
        pending.current.delete(src);
        setBusy();
      }
    },
    [editor, onError, setBusy]
  );

  useEffect(() => {
    if (!editor) return undefined;
    const scan = () => {
      editor.state.doc.descendants((node) => {
        const src = node.type.name === "image" ? node.attrs.src : null;
        if (src && !hosted.current.has(src) && !pending.current.has(src)) upload(src);
      });
    };
    editor.on("update", scan);
    return () => editor.off("update", scan);
  }, [editor, upload]);
}

/** Inserts dropped/pasted/picked image files immediately; the pass above hosts them. */
export function insertImageFiles(view, files) {
  const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
  if (!images.length) return false;
  const { schema, tr } = view.state;
  images.forEach((file) => {
    tr.replaceSelectionWith(schema.nodes.image.create({ src: URL.createObjectURL(file) }));
  });
  view.dispatch(tr);
  return true;
}

export const noteImageHandlers = {
  handlePaste: (view, event) => insertImageFiles(view, event.clipboardData?.files || []),
  handleDrop: (view, event) => insertImageFiles(view, event.dataTransfer?.files || []),
};

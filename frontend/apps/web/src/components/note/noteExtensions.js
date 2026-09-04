import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { TextStyle } from "@tiptap/extension-text-style";
import { StarterKit } from "@tiptap/starter-kit";

/**
 * The note editor schema — deliberately the same set the backend accepts, so a
 * saved document round-trips unchanged.
 *
 * Colors render as classes carrying a palette *name* rather than inline CSS.
 * That is what lets a note written in light mode stay readable in dark mode,
 * and it is why the server can reject every color it does not recognize.
 */

const colorAttribute = (dataAttribute, className) => ({
  color: {
    default: null,
    parseHTML: (element) => element.getAttribute(dataAttribute),
    renderHTML: (attributes) =>
      attributes.color
        ? {
            [dataAttribute]: attributes.color,
            class: `${className} ${className}--${attributes.color}`,
          }
        : {},
  },
});

const NoteTextStyle = TextStyle.extend({
  addAttributes() {
    return colorAttribute("data-note-color", "note-color");
  },
});

const NoteHighlight = Highlight.extend({
  addAttributes() {
    return colorAttribute("data-note-highlight", "note-mark");
  },
});

export function buildNoteExtensions(placeholder) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
    }),
    NoteTextStyle,
    NoteHighlight.configure({ multicolor: true }),
    // Images sit between blocks rather than inside a paragraph, which is what
    // makes a pasted screenshot behave like its own item in the note.
    Image.configure({ inline: false, allowBase64: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder }),
  ];
}

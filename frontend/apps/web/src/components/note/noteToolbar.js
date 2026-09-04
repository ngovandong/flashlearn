import { useRef, useState } from "react";
import { NOTE_COLORS } from "@flashlearn/core";
import { useEditorState } from "@tiptap/react";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import ChecklistIcon from "@mui/icons-material/Checklist";
import CodeIcon from "@mui/icons-material/Code";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import FormatColorTextIcon from "@mui/icons-material/FormatColorText";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import FormatStrikethroughIcon from "@mui/icons-material/FormatStrikethrough";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import TitleIcon from "@mui/icons-material/Title";
import Popover from "@mui/material/Popover";

import { insertImageFiles } from "./noteImages";

/**
 * Formatting controls for the note editor.
 *
 * The row scrolls horizontally on narrow screens rather than wrapping, so the
 * editor body never gets pushed off-screen on a phone.
 */
export default function NoteToolbar({ editor }) {
  const [colorAnchor, setColorAnchor] = useState(null);
  const [highlightAnchor, setHighlightAnchor] = useState(null);
  const fileInput = useRef(null);

  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      underline: instance.isActive("underline"),
      strike: instance.isActive("strike"),
      code: instance.isActive("code"),
      heading: instance.isActive("heading", { level: 2 }),
      bulletList: instance.isActive("bulletList"),
      orderedList: instance.isActive("orderedList"),
      taskList: instance.isActive("taskList"),
      blockquote: instance.isActive("blockquote"),
      color: instance.getAttributes("textStyle").color || null,
      highlight: instance.getAttributes("highlight").color || null,
    }),
  });

  const run = (fn) => () => fn(editor.chain().focus()).run();

  const setColor = (color) => {
    run((chain) => (color ? chain.setMark("textStyle", { color }) : chain.unsetMark("textStyle")))();
    setColorAnchor(null);
  };

  const setHighlight = (color) => {
    run((chain) => (color ? chain.setHighlight({ color }) : chain.unsetHighlight()))();
    setHighlightAnchor(null);
  };

  return (
    <div className="note-toolbar" role="toolbar" aria-label="Note formatting">
      <NoteToolbarButton label="Bold" active={active.bold} onClick={run((c) => c.toggleBold())}>
        <FormatBoldIcon fontSize="small" />
      </NoteToolbarButton>
      <NoteToolbarButton label="Italic" active={active.italic} onClick={run((c) => c.toggleItalic())}>
        <FormatItalicIcon fontSize="small" />
      </NoteToolbarButton>
      <NoteToolbarButton label="Underline" active={active.underline} onClick={run((c) => c.toggleUnderline())}>
        <FormatUnderlinedIcon fontSize="small" />
      </NoteToolbarButton>
      <NoteToolbarButton label="Strikethrough" active={active.strike} onClick={run((c) => c.toggleStrike())}>
        <FormatStrikethroughIcon fontSize="small" />
      </NoteToolbarButton>

      <span className="note-toolbar__divider" />

      <NoteToolbarButton
        label="Text color"
        active={Boolean(active.color)}
        onClick={(event) => setColorAnchor(event.currentTarget)}
      >
        <FormatColorTextIcon fontSize="small" />
      </NoteToolbarButton>
      <NoteToolbarButton
        label="Highlight"
        active={Boolean(active.highlight)}
        onClick={(event) => setHighlightAnchor(event.currentTarget)}
      >
        <BorderColorIcon fontSize="small" />
      </NoteToolbarButton>

      <span className="note-toolbar__divider" />

      <NoteToolbarButton label="Heading" active={active.heading} onClick={run((c) => c.toggleHeading({ level: 2 }))}>
        <TitleIcon fontSize="small" />
      </NoteToolbarButton>
      <NoteToolbarButton label="Bullet list" active={active.bulletList} onClick={run((c) => c.toggleBulletList())}>
        <FormatListBulletedIcon fontSize="small" />
      </NoteToolbarButton>
      <NoteToolbarButton
        label="Numbered list"
        active={active.orderedList}
        onClick={run((c) => c.toggleOrderedList())}
      >
        <FormatListNumberedIcon fontSize="small" />
      </NoteToolbarButton>
      <NoteToolbarButton label="Checklist" active={active.taskList} onClick={run((c) => c.toggleTaskList())}>
        <ChecklistIcon fontSize="small" />
      </NoteToolbarButton>
      <NoteToolbarButton label="Quote" active={active.blockquote} onClick={run((c) => c.toggleBlockquote())}>
        <FormatQuoteIcon fontSize="small" />
      </NoteToolbarButton>
      <NoteToolbarButton label="Inline code" active={active.code} onClick={run((c) => c.toggleCode())}>
        <CodeIcon fontSize="small" />
      </NoteToolbarButton>

      <span className="note-toolbar__divider" />

      <NoteToolbarButton
        label="Clear formatting"
        onClick={run((c) => c.unsetAllMarks().clearNodes())}
      >
        <FormatClearIcon fontSize="small" />
      </NoteToolbarButton>

      <span className="note-toolbar__divider" />

      {/* Pasting and dropping work too; this is for anyone who reaches for a button. */}
      <NoteToolbarButton label="Add image" onClick={() => fileInput.current?.click()}>
        <ImageOutlinedIcon fontSize="small" />
      </NoteToolbarButton>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          insertImageFiles(editor.view, event.target.files || []);
          event.target.value = "";
        }}
      />

      <NoteSwatchPopover
        anchor={colorAnchor}
        current={active.color}
        variant="text"
        onSelect={setColor}
        onClose={() => setColorAnchor(null)}
      />
      <NoteSwatchPopover
        anchor={highlightAnchor}
        current={active.highlight}
        variant="highlight"
        onSelect={setHighlight}
        onClose={() => setHighlightAnchor(null)}
      />
    </div>
  );
}

function NoteToolbarButton({ label, active = false, onClick, children }) {
  return (
    <button
      type="button"
      className={`note-toolbar__btn${active ? " note-toolbar__btn--active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keep the selection: the editor must not lose focus when a control is hit.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NoteSwatchPopover({ anchor, current, variant, onSelect, onClose }) {
  return (
    <Popover
      open={Boolean(anchor)}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      slotProps={{ paper: { className: "note-swatches" } }}
    >
      {NOTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`note-swatch note-swatch--${variant}${current === color ? " note-swatch--on" : ""}`}
          style={{ "--note-swatch": `var(--fl-note-${color})` }}
          title={color}
          aria-label={color}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(color)}
        />
      ))}
      <button
        type="button"
        className="note-swatch note-swatch--none"
        title="No color"
        aria-label="No color"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(null)}
      >
        <FormatClearIcon fontSize="inherit" />
      </button>
    </Popover>
  );
}

import type { ReminderTone } from "@flashlearn/core";
import type { MD3Theme } from "react-native-paper";

// Map the core reminder `icon` keys (icon-free metadata) to MaterialIcons glyph
// names available in @expo/vector-icons.
const ICON_MAP: Record<string, string> = {
  "auto-awesome": "auto-awesome",
  "record-voice-over": "record-voice-over",
  forum: "forum",
  "edit-note": "edit-note",
  "history-edu": "history-edu",
  headphones: "headphones",
  hearing: "hearing",
  "menu-book": "menu-book",
  spellcheck: "spellcheck",
  style: "style",
  casino: "casino",
};

export function reminderIconName(iconKey: string): string {
  return ICON_MAP[iconKey] ?? "school";
}

/** Pick a theme color for a reminder tone (uses the first color of dual tones). */
export function reminderToneColor(tone: ReminderTone, theme: MD3Theme): string {
  switch (tone) {
    case "violet":
    case "violet-blue":
      return theme.colors.primary;
    case "blue":
      return theme.colors.secondary;
    case "amber":
    case "amber-violet":
      return theme.colors.tertiary;
    case "blue-amber":
      return theme.colors.secondary;
    default:
      return theme.colors.primary;
  }
}

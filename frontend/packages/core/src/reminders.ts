// Icon-free presentation metadata for each reminder `type` the API returns.
// Copy + color tone + an abstract `icon` key live here so both web (MUI) and
// native (vector icons) can map the key to their own icon component. The
// dynamic `label` (deck/course/conversation name) is woven into the
// description by each caller.

export type ReminderTone =
  | "violet"
  | "blue"
  | "amber"
  | "violet-blue"
  | "blue-amber"
  | "amber-violet";

export interface ReminderMeta {
  tone: ReminderTone;
  icon: string;
  title: string;
  description: (label?: string | null) => string;
  cta: string;
}

export const REMINDER_META: Record<string, ReminderMeta> = {
  revise_all: {
    tone: "violet",
    icon: "auto-awesome",
    title: "Revise your mistakes",
    description: () =>
      "A quick mixed round — words, grammar, listening and speaking — focused on what you got wrong.",
    cta: "Start revising",
  },
  speaking_new: {
    tone: "violet",
    icon: "record-voice-over",
    title: "Practice speaking",
    description: () =>
      "Generate a fresh conversation and role-play it out loud with your AI coach.",
    cta: "Start speaking",
  },
  speaking_revise: {
    tone: "blue",
    icon: "forum",
    title: "Revise a conversation",
    description: (label) => `Revisit “${label}” and sharpen your pronunciation.`,
    cta: "Revise now",
  },
  writing_new: {
    tone: "violet-blue",
    icon: "edit-note",
    title: "Practice writing",
    description: () =>
      "Draft a piece or chat with your AI writing coach for instant feedback.",
    cta: "Start writing",
  },
  writing_revise: {
    tone: "blue-amber",
    icon: "history-edu",
    title: "Revisit your writing",
    description: (label) => `Pick up “${label}” and refine it further.`,
    cta: "Open writing",
  },
  listening_dictation: {
    tone: "violet-blue",
    icon: "headphones",
    title: "Take a listening test",
    description: () =>
      "Listen to a short clip and type what you hear — the coach scores every word.",
    cta: "Start dictation",
  },
  listening: {
    tone: "amber",
    icon: "hearing",
    title: "Number listening",
    description: () => "Train your ear by typing the English numbers you hear.",
    cta: "Start practice",
  },
  course: {
    tone: "violet-blue",
    icon: "menu-book",
    title: "Continue your course",
    description: (label) => `Pick up the next lesson in ${label}.`,
    cta: "Resume course",
  },
  grammar_new: {
    tone: "violet",
    icon: "menu-book",
    title: "Practise grammar",
    description: () =>
      "Study a grammar rule from Essential Grammar in Use, then nail it with auto-graded exercises.",
    cta: "Start grammar",
  },
  grammar_revise: {
    tone: "blue-amber",
    icon: "spellcheck",
    title: "Finish a grammar unit",
    description: (label) => `Pick up “${label}” and complete its exercises.`,
    cta: "Resume unit",
  },
  learn: {
    tone: "blue-amber",
    icon: "style",
    title: "Learn a deck",
    description: (label) => `Keep studying “${label}”.`,
    cta: "Start learning",
  },
  revise: {
    tone: "amber-violet",
    icon: "casino",
    title: "Play a revise round",
    description: (label) => `Test yourself on “${label}”.`,
    cta: "Play now",
  },
};

import React from "react";
import HearingIcon from "@mui/icons-material/Hearing";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import CasinoRoundedIcon from "@mui/icons-material/CasinoRounded";

// Presentation for each reminder `type` the API returns. Copy + icon + color
// tone live here; the dynamic `label` (deck/course/conversation name) is woven
// into the description by the API.
export const REMINDER_META = {
  speaking_new: {
    tone: "violet",
    icon: <RecordVoiceOverIcon />,
    title: "Practice speaking",
    description: () =>
      "Generate a fresh conversation and role-play it out loud with your AI coach.",
    cta: "Start speaking",
  },
  speaking_revise: {
    tone: "blue",
    icon: <ForumRoundedIcon />,
    title: "Revise a conversation",
    description: (label) => `Revisit “${label}” and sharpen your pronunciation.`,
    cta: "Revise now",
  },
  listening: {
    tone: "amber",
    icon: <HearingIcon />,
    title: "Number listening",
    description: () =>
      "Train your ear by typing the English numbers you hear.",
    cta: "Start practice",
  },
  course: {
    tone: "violet-blue",
    icon: <MenuBookRoundedIcon />,
    title: "Continue your course",
    description: (label) => `Pick up the next lesson in ${label}.`,
    cta: "Resume course",
  },
  learn: {
    tone: "blue-amber",
    icon: <StyleRoundedIcon />,
    title: "Learn a deck",
    description: (label) => `Keep studying “${label}”.`,
    cta: "Start learning",
  },
  revise: {
    tone: "amber-violet",
    icon: <CasinoRoundedIcon />,
    title: "Play a revise round",
    description: (label) => `Test yourself on “${label}”.`,
    cta: "Play now",
  },
};

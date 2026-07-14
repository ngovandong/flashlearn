import type { QuestionType, Role } from "./types";

export const ROLES: Record<"EDIT" | "VIEWONLY" | "OWNER", Role> = {
  EDIT: "E",
  VIEWONLY: "V",
  OWNER: "O",
};

export const QUESTION_TYPES: Record<"QUIZ" | "FILL", QuestionType> = {
  QUIZ: "QUIZ",
  FILL: "FILL",
};

export const LEARNING_TERM_PAGE_SIZE = 20;
export const DECK_PAGE_SIZE = 20;
export const COURSE_PAGE_SIZE = 10;

export const IMAGE_SEARCH_COUNT = 10;

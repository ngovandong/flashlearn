// Re-export from the shared @flashlearn/core package. The implementation now
// lives there so the mobile app can reuse the same answer-checking logic.
export {
  levenshtein,
  normalizeAnswer,
  buildVariants,
  checkAnswer,
  diffAnswer,
} from "@flashlearn/core";

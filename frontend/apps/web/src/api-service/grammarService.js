import BaseService from "./baseService";
import { AI_REQUEST_TIMEOUT } from "./httpRequest";

// Shared axios config for the AI-backed "explain" call so it tolerates the
// backend's rate-limit queue + provider latency instead of timing out.
const AI_CONFIG = { timeout: AI_REQUEST_TIMEOUT };

class GrammarService extends BaseService {
  constructor() {
    super("grammar");
  }

  // { books: [{ slug, title, level, description, source, background,
  //   total_units, completed_units }] } — every imported book for the selector.
  getBooks() {
    return this.request.get(this.action("books"));
  }

  // { book: { slug, title, level, description, background },
  //   sections: [{ id, slug, title, description, order, total_units,
  //     completed_units, units: [{ key, slug, number, title, total_exercises,
  //     completed_exercises, status, best_score }] }] }
  // `bookSlug` selects the book (defaults to the first on the server).
  getCatalog(bookSlug) {
    return this.request.get(this.base, bookSlug ? { params: { book: bookSlug } } : undefined);
  }

  // { key, slug, number, title, description, explanation, section, book,
  //   exercises: [{ id, key, slug, title, order, kind, prompt, options, items,
  //   progress }], progress, prev_key, next_key }
  getUnit(unitKey) {
    return this.request.get(this.detail(unitKey));
  }

  // Grade a submitted attempt server-side. `submissions` is aligned to the
  // exercise's items — each entry is a list of typed strings (one per blank).
  // Returns { score, completed, results, progress, unit_progress } where
  // `results` reveal the canonical answers so the client can show right/wrong.
  submitExercise(exerciseKey, submissions) {
    return this.request.post(this.action("submit_exercise"), {
      exercise_key: exerciseKey,
      submissions,
    });
  }

  // Reset the user's saved practice results for a whole unit (saved highlights
  // are kept). Returns { cleared } — how many exercise attempts were removed.
  clearUnitProgress(unitKey) {
    return this.request.post(this.action("clear_progress"), { unit_key: unitKey });
  }

  // AI "explain" option: explain a rule, or why an answer is wrong. Pass any of
  // { question, unit_title, sentence, given, correct }. Returns { answer,
  // examples, tip }.
  explain(payload) {
    return this.request.post(this.action("explain"), payload, AI_CONFIG);
  }

  // Add/update (or remove with { remove: true }) a per-user noted word/phrase on
  // a unit. Returns { highlights }.
  setHighlight(unitKey, { text, note = "", remove = false } = {}) {
    return this.request.post(this.action("highlight"), {
      unit_key: unitKey,
      text,
      note,
      remove,
    });
  }
}

export const grammarService = new GrammarService();

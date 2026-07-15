import BaseService from "./baseService";

class ListeningService extends BaseService {
  constructor() {
    super("listening");
  }

  // [{ id, slug, title, level, description, order, total_exercises, completed_exercises }]
  getTopics() {
    return this.request.get(this.action("topics"));
  }

  // { id, slug, title, level, description, order, exercises: [{ id, slug, key,
  // title, level, order, sentence_count, has_audio, progress }] }
  getTopic(slug) {
    return this.request.get(this.detail(slug));
  }

  // { id, slug, key, title, level, full_audio_url, topic, sentences: [{ position,
  // text, tokens, audio_url, time_start, time_end, hint, explanation }], progress,
  // prev_id, next_id }
  getExercise(id) {
    return this.request.get(`${this.action("exercise")}?id=${id}`);
  }

  // Persist a listen-and-type attempt so it replays (with mistakes) on revisit.
  // The typed text is scored client-side; this stores the breakdown + completion.
  // `lines` is [{ position, target, typed, correct, total, tokens_correct }].
  submit({ exerciseId, score, lines }) {
    return this.request.post(this.action("submit"), {
      exercise_id: exerciseId,
      score,
      lines,
    });
  }

  // Auto-save the per-sentence answers checked so far so a long exercise can be
  // resumed later. Does not count an attempt or change the best score.
  // `lines` is [{ position, target, typed, correct, total, tokens_correct }].
  saveProgress({ exerciseId, lines }) {
    return this.request.post(this.action("save_progress"), {
      exercise_id: exerciseId,
      lines,
    });
  }

  // Clear the saved per-sentence answers so the exercise starts fresh.
  resetProgress(exerciseId) {
    return this.request.post(this.action("reset_progress"), { exercise_id: exerciseId });
  }

  // Add/update (or remove with { remove: true }) a per-user noted word/phrase on
  // an exercise so it re-highlights on revisit. Returns { highlights }.
  setHighlight(exerciseId, { text, note = "", remove = false } = {}) {
    return this.request.post(this.action("highlight"), {
      exercise_id: exerciseId,
      text,
      note,
      remove,
    });
  }

  // Translate a sentence to the user's language (free Google, AI backup). Does
  // not persist anything. Returns { translation, provider }.
  translate({ text, targetLanguage = "vi" } = {}) {
    return this.request.post(this.action("translate"), {
      text,
      target_language: targetLanguage,
    });
  }

  // Save a per-user, per-sentence translation and/or note (keyed by position).
  // Pass only the field(s) you want to change. Returns { sentence_meta }.
  saveSentenceMeta(exerciseId, { position, translation, note } = {}) {
    const payload = { exercise_id: exerciseId, position };
    if (translation !== undefined) payload.translation = translation;
    if (note !== undefined) payload.note = note;
    return this.request.post(this.action("sentence_meta"), payload);
  }
}

export const listeningService = new ListeningService();

import BaseService from "./baseService";
import { AI_REQUEST_TIMEOUT } from "./httpRequest";

// Speaking cards are graded by the pronunciation service (upload + provider
// latency), so those answers get the longer AI timeout.
const AI_CONFIG = { timeout: AI_REQUEST_TIMEOUT };

class ReviseService extends BaseService {
  constructor() {
    super("revise");
  }

  // Build a fresh mixed session. Returns { cards: [{ id, kind, prompt, payload,
  // seen_count, mistake_count }], counts: { vocab, grammar, listening, speaking } }.
  // Cards are answer-free — the canonical answer is only revealed when grading.
  buildSession(size = 12) {
    return this.request.post(this.action("session"), { size });
  }

  // Grade one card. `given` is the typed text / chosen option (or a list of
  // blanks for grammar). Returns { correct, answer, mastered, correct_streak,
  // mistake_count, ... }.
  answer(cardId, given) {
    return this.request.post(this.action("answer"), { card_id: cardId, given });
  }

  // Grade a speaking card from recorded audio (base64). Returns the above plus
  // { score, result } from the pronunciation analysis.
  answerSpeaking(cardId, { audio, mimeType }) {
    return this.request.post(
      this.action("answer"),
      { card_id: cardId, audio, mime_type: mimeType },
      AI_CONFIG
    );
  }
}

export const reviseService = new ReviseService();

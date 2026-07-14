import BaseService from "./baseService";
import { AI_REQUEST_TIMEOUT } from "./httpRequest";

// Shared axios config for the AI-backed calls so they tolerate the backend's
// rate-limit queue + provider latency instead of timing out / hanging.
const AI_CONFIG = { timeout: AI_REQUEST_TIMEOUT };

class WritingService extends BaseService {
  constructor() {
    super("writing");
  }

  suggestTopics(history = [], level) {
    return this.request.post(
      this.action("suggest_topics"),
      { history, level },
      AI_CONFIG
    );
  }

  // ── Chat mode ───────────────────────────────────────────────────────────
  startChat({ topic, level, tone }) {
    return this.request.post(
      this.action("start_chat"),
      { topic, level, tone },
      AI_CONFIG
    );
  }

  sendMessage(id, text) {
    return this.request.post(
      this.detailAction(id, "chat_message"),
      { text },
      AI_CONFIG
    );
  }

  // ── Free-form mode ────────────────────────────────────────────────────────
  writingSupport(topic, level) {
    return this.request.post(
      this.action("writing_support"),
      { topic, level },
      AI_CONFIG
    );
  }

  submitDraft({ topic, draft, level, tone }) {
    return this.request.post(
      this.action("submit_draft"),
      { topic, draft, level, tone },
      AI_CONFIG
    );
  }

  // ── Highlight / vocab ─────────────────────────────────────────────────────
  explainPhrase(text, context = "") {
    return this.request.post(
      this.action("explain_phrase"),
      { text, context },
      AI_CONFIG
    );
  }

  // Returns { matches: [{ term_id, deck_id, name }] } — the user's own terms
  // found in the given texts so they can be highlighted and deep-linked to
  // /deck/:deck_id/learn/:term_id. Pass a session id string, or an object with
  // an explicit `texts` array.
  matchTerms(arg) {
    const payload =
      arg && typeof arg === "object"
        ? { texts: arg.texts }
        : { session_id: arg };
    return this.request.post(this.action("match_terms"), payload);
  }

  // Add/update (or remove with { remove: true }) a noted word/phrase on a
  // session. Returns { id, highlights }.
  setHighlight(id, { text, note = "", remove = false } = {}) {
    return this.request.post(this.detailAction(id, "highlight"), {
      text,
      note,
      remove,
    });
  }

  // ── History ───────────────────────────────────────────────────────────────
  getSession(id) {
    return this.request.get(this.detail(id));
  }

  getHistory() {
    return this.request.get(this.action("history"));
  }

  deleteSession(id) {
    return this.request.delete(this.detail(id));
  }

  bulkDeleteSessions(ids) {
    return this.request.post(this.action("bulk_delete"), { ids });
  }

  setStar(id, starred) {
    return this.request.post(this.detailAction(id, "star"), { starred });
  }
}

export const writingService = new WritingService();

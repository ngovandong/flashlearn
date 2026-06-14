import BaseService from "./baseService";
import { AI_REQUEST_TIMEOUT } from "./httpRequest";

// Shared axios config for the AI-backed calls so they tolerate the backend's
// rate-limit queue + provider latency instead of timing out / hanging.
const AI_CONFIG = { timeout: AI_REQUEST_TIMEOUT };

class SpeakingService extends BaseService {
  constructor() {
    super("speaking");
  }

  generateConversation(payload) {
    return this.request.post(this.action("generate_conversation"), payload, AI_CONFIG);
  }

  suggestTopics(history = [], level) {
    return this.request.post(this.action("suggest_topics"), { history, level }, AI_CONFIG);
  }

  // audio is a base64 string (without the data: prefix); kind is "single" | "full".
  analyze({ targetText, audio, mimeType = "audio/webm", kind = "single", conversationId }) {
    return this.request.post(
      this.action("analyze"),
      {
        target_text: targetText,
        audio,
        mime_type: mimeType,
        kind,
        conversation_id: conversationId,
      },
      AI_CONFIG
    );
  }

  explainPhrase(text, context = "") {
    return this.request.post(this.action("explain_phrase"), { text, context }, AI_CONFIG);
  }

  // Returns { audio: base64 (raw 16-bit PCM), mime_type } from Gemini TTS.
  generateSpeech(text, voice) {
    return this.request.post(this.action("speak"), { text, voice }, AI_CONFIG);
  }

  getConversation(id) {
    return this.request.get(this.detail(id));
  }

  deleteConversation(id) {
    return this.request.delete(this.detail(id));
  }

  bulkDeleteConversations(ids) {
    return this.request.post(this.action("bulk_delete"), { ids });
  }

  setStar(id, starred) {
    return this.request.post(this.detailAction(id, "star"), { starred });
  }

  getVoices() {
    return this.request.get(this.action("voices"));
  }

  // Returns { matches: [{ term_id, deck_id, name }] } — the user's own terms
  // found in the conversation so they can be highlighted and deep-linked to
  // /deck/:deck_id/learn/:term_id.
  matchTerms(conversationId) {
    return this.request.post(this.action("match_terms"), { conversation_id: conversationId });
  }

  // Add/update (or remove with { remove: true }) a noted word/phrase on a
  // conversation. Returns { id, highlights }.
  setHighlight(id, { text, note = "", remove = false } = {}) {
    return this.request.post(this.detailAction(id, "highlight"), { text, note, remove });
  }

  getHistory() {
    return this.request.get(this.action("history"));
  }
}

export const speakingService = new SpeakingService();

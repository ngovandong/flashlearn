import BaseService from "./baseService";
import { AI_REQUEST_TIMEOUT } from "./httpRequest";

// Shared axios config for the AI-backed call so it tolerates the backend's
// rate-limit queue + provider latency instead of timing out / hanging.
const AI_CONFIG = { timeout: AI_REQUEST_TIMEOUT };

class AssistantService extends BaseService {
  constructor() {
    super("assistant");
  }

  // history: [{ role: "user" | "assistant", text }] — a short rolling
  // transcript; page: the route the user is currently on (for context).
  // Returns { reply, actions: [{ type, label, route?, tour_id? }], suggestions }.
  chat({ message, history = [], page = "" }) {
    return this.request.post(
      this.action("chat"),
      { message, history, page },
      AI_CONFIG
    );
  }
}

export const assistantService = new AssistantService();

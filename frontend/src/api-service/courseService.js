import BaseService from "./baseService";
import { AI_REQUEST_TIMEOUT } from "./httpRequest";

const AI_CONFIG = { timeout: AI_REQUEST_TIMEOUT };

class CourseService extends BaseService {
  constructor() {
    super("courses");
  }

  // Paginated catalog (10 per page): { count, next, previous, results: [{ id,
  // slug, title, level, description, order, total_lessons, passed_lessons }] }.
  // Optionally filtered to a single `level` (e.g. "A2").
  getCatalog(page = 1, level = "") {
    const params = new URLSearchParams({ page });
    if (level) params.set("level", level);
    return this.request.get(`${this.base}?${params.toString()}`);
  }

  // Distinct course levels for the catalog filter: { levels: ["A2", "B1", ...] }.
  getLevels() {
    return this.request.get(this.action("levels"));
  }

  // Admin-only: delete a course (cascades its sections + lessons).
  deleteCourse(slug) {
    return this.request.delete(this.detail(slug));
  }

  // { id, slug, title, level, description, sections: [{ ..., lessons: [...] }] }
  getCourse(slug) {
    return this.request.get(this.detail(slug));
  }

  // { lines: [{ voice, text, audio_url, audio: base64, mime_type }] } — one
  // generated Azure TTS clip per distinct character line. Prefer audio_url
  // (hosted on Cloudinary); audio is a fallback for un-migrated clips.
  getLessonAudio(lessonId) {
    return this.request.get(`${this.action("lesson_audio")}?lesson_id=${lessonId}`);
  }

  // Score a Live Role-play sentence-by-sentence; passes the lesson when the
  // averaged score >= threshold. `segments` is
  // [{ target_text, audio (base64, no data: prefix), mime_type }] — one per
  // spoken line. Returns { score, passed, threshold, sessions, progress }.
  submitRolePlay({ lessonId, segments }) {
    return this.request.post(
      this.action("role_play"),
      { lesson_id: lessonId, segments },
      AI_CONFIG
    );
  }

  // Add/update (or remove with { remove: true }) a per-user noted word/phrase on
  // a lesson so it re-highlights on revisit. Returns { highlights }.
  setHighlight(lessonId, { text, note = "", remove = false } = {}) {
    return this.request.post(this.action("highlight"), {
      lesson_id: lessonId,
      text,
      note,
      remove,
    });
  }
}

export const courseService = new CourseService();

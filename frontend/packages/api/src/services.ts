import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { getFirstError, TERM_EDIT_PAGE_SIZE } from "@flashlearn/core";
import type {
  AuthUser,
  CourseDetail,
  CourseSummary,
  Deck,
  DeckDetail,
  LearningStreak,
  LoginPayload,
  Note,
  NoteDoc,
  NoteTargetType,
  PaginatedResponse,
  Reminder,
  ReviseAnswerResult,
  ReviseSession,
  ReviseTermsResponse,
  Term,
} from "@flashlearn/core";

/**
 * The shared HTTP client resolves failed requests with `{ error }` (or a raw
 * AxiosError) instead of rejecting. Methods that return the payload directly
 * must surface those failures as thrown errors, otherwise a consumer like React
 * Query receives `undefined` ("Query data cannot be undefined").
 */
function unwrapResponse<T>(res: AxiosResponse<T> | { error?: unknown } | unknown): T {
  const r = res as { data?: T; error?: unknown };
  if (r && typeof r === "object" && "error" in r && r.error !== undefined) {
    throw new Error(getFirstError(r.error));
  }
  if (r && typeof r === "object" && "data" in r && r.data !== undefined) {
    return r.data as T;
  }
  throw new Error("Something went wrong. Please try again.");
}

/**
 * Auth endpoints shared across platforms. `login`/`logout`/`extensionToken`
 * behave identically everywhere; `refresh` here is the cookie-based web flow —
 * the native adapter supplies its own body-based refresh.
 */
export function createAuthApi(client: AxiosInstance) {
  return {
    login(email: string, password: string): Promise<any> {
      return client.post("users/login/", { email, password });
    },
    signUp(user: Record<string, unknown>): Promise<any> {
      return client.post("users/sign_up/", user);
    },
    initUser(token: string): Promise<any> {
      return client.get("users/init/", {
        headers: { Authorization: token, "Content-Type": "application/json" },
      });
    },
    async getUser(): Promise<AuthUser> {
      const res: AxiosResponse<AuthUser> = await client.get("users/get_profile/");
      return res.data;
    },
    async refresh(): Promise<{ access: string }> {
      const res: AxiosResponse<{ access: string }> = await client.post(
        "users/refresh/"
      );
      return res.data;
    },
    logout(): Promise<any> {
      return client.post("users/logout/");
    },
    async extensionToken(): Promise<LoginPayload> {
      const res: AxiosResponse<LoginPayload> = await client.post(
        "users/extension_token/"
      );
      return res.data;
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;

export interface UserSettings {
  theme_mode?: string;
  theme_palette?: string;
  theme_surface?: string;
  daily_reminder?: boolean;
  reminder_email?: string;
  [key: string]: unknown;
}

export function createUserSettingsApi(client: AxiosInstance) {
  return {
    async getSettings(): Promise<UserSettings> {
      return unwrapResponse<UserSettings>(
        await client.get<UserSettings>("users/my_settings/")
      );
    },
    async updateSettings(data: Partial<UserSettings>): Promise<UserSettings> {
      return unwrapResponse<UserSettings>(
        await client.patch<UserSettings>("users/my_settings/", data)
      );
    },
    async getLearningStreak(): Promise<LearningStreak> {
      return unwrapResponse<LearningStreak>(
        await client.get<LearningStreak>("users/learning_streak/")
      );
    },
    recordStudyActivity(): Promise<any> {
      return client.post("users/record_study/");
    },
  };
}

export type UserSettingsApi = ReturnType<typeof createUserSettingsApi>;

export function createReminderApi(client: AxiosInstance) {
  return {
    async getReminders(): Promise<Reminder[]> {
      return unwrapResponse<Reminder[]>(await client.get<Reminder[]>("reminders/"));
    },
  };
}

export type ReminderApi = ReturnType<typeof createReminderApi>;

// ── Assistant (Dragon chat) ────────────────────────────────────────────────

export interface AssistantAction {
  type: "navigate" | "tour";
  label: string;
  route?: string;
  tour_id?: string;
}

export interface AssistantReply {
  reply: string;
  actions?: AssistantAction[];
  suggestions?: string[];
}

export function createAssistantApi(client: AxiosInstance, aiTimeout = 240000) {
  const aiConfig: AxiosRequestConfig = { timeout: aiTimeout };
  return {
    chat(payload: {
      message: string;
      history?: { role: string; text: string }[];
      page?: string;
    }): Promise<any> {
      return client.post(
        "assistant/chat/",
        {
          message: payload.message,
          history: payload.history ?? [],
          page: payload.page ?? "",
        },
        aiConfig
      );
    },
  };
}

export type AssistantApi = ReturnType<typeof createAssistantApi>;

// ── Deck ────────────────────────────────────────────────────────────────────

export function createDeckApi(client: AxiosInstance) {
  return {
    list(): Promise<any> {
      return client.get("decks/");
    },
    retrieve(id: string): Promise<any> {
      return client.get(`decks/${id}/`);
    },
    create(data: Partial<Deck>): Promise<any> {
      return client.post("decks/", data);
    },
    update(id: string, data: Partial<Deck>): Promise<any> {
      return client.put(`decks/${id}/`, data);
    },
    partialUpdate(id: string, data: Partial<Deck>): Promise<any> {
      return client.patch(`decks/${id}/`, data);
    },
    delete(id: string): Promise<any> {
      return client.delete(`decks/${id}/`);
    },
    getMyDecks(): Promise<any> {
      return client.get("decks/my_decks/");
    },
    getPublicDecks(page = 1): Promise<any> {
      return client.get("decks/public_decks/", { params: { page } });
    },
    getMyOwnDecks(page = 1): Promise<any> {
      return client.get("decks/my_own_decks/", { params: { page } });
    },
    getLatestDecks(): Promise<any> {
      return client.get("decks/latest_decks/");
    },
    getOthersDeck(page = 1): Promise<any> {
      return client.get("decks/others_deck/", { params: { page } });
    },
    getInviteUrl(id: string, role: string): Promise<any> {
      return client.post(`decks/${id}/get_invite_url/`, { role });
    },
    addUserToDeck(id: string, user: Record<string, unknown>): Promise<any> {
      return client.post(`decks/${id}/add_user_to_deck/`, user);
    },
    removeUserFromDeck(id: string, email: string): Promise<any> {
      return client.post(`decks/${id}/remove_user_from_deck/`, { email });
    },
    clearLearningProgress(id: string): Promise<any> {
      return client.put(`decks/${id}/clear_learning_process/`);
    },
    searchDeck(query: string): Promise<any> {
      return client.get("decks/", { params: { query } });
    },
    joinDeck(id: string): Promise<any> {
      return client.post(`decks/${id}/join_deck/`);
    },
    cloneDeck(id: string): Promise<any> {
      return client.get(`decks/${id}/clone/`);
    },
    leaveDeck(id: string): Promise<any> {
      return client.post(`decks/${id}/leave_deck/`);
    },
  };
}

export type DeckApi = ReturnType<typeof createDeckApi>;

// ── Term ────────────────────────────────────────────────────────────────────

const AI_STRING_FIELDS = ["word_type", "pronunciation", "definition"];
const AI_LIST_FIELDS = [
  "synonyms",
  "antonyms",
  "examples",
  "word_forms",
  "word_family",
];

function appendAiFields(
  formData: FormData,
  prefix: string,
  term: Term
): void {
  for (const field of AI_STRING_FIELDS) {
    const val = term[field];
    if (val !== undefined && val !== null) {
      formData.append(`${prefix}[${field}]`, String(val));
    }
  }
  for (const field of AI_LIST_FIELDS) {
    if (term[field] !== undefined) {
      formData.append(
        `${prefix}[${field}]`,
        JSON.stringify(term[field] || [])
      );
    }
  }
  if (term.ai_filled !== undefined) {
    formData.append(`${prefix}[ai_filled]`, term.ai_filled ? "true" : "false");
  }
}

export function createTermApi(client: AxiosInstance, aiTimeout = 240000) {
  const aiConfig: AxiosRequestConfig = { timeout: aiTimeout };

  return {
    getTermsByDeck(deckId: string, page = 1): Promise<any> {
      return client.get("terms/", { params: { deck_id: deckId, page } });
    },
    getTermsByDeckCursor(deckId: string, cursor: string | null = null): Promise<any> {
      const params: Record<string, string> = { deck_id: deckId };
      if (cursor) params.cursor = cursor;
      return client.get("terms/", { params });
    },
    /** Numbered page of a deck's terms, optionally filtered by text and re-sorted. */
    browseTerms(
      deckId: string,
      {
        q = "",
        sort = "newest",
        page = 1,
        pageSize = TERM_EDIT_PAGE_SIZE,
      }: { q?: string; sort?: string; page?: number; pageSize?: number } = {}
    ): Promise<any> {
      return client.get("terms/browse/", {
        params: { deck_id: deckId, q, sort, page, page_size: pageSize },
      });
    },
    bulkDelete(deckId: string, ids: string[]): Promise<any> {
      return client.post("terms/bulk_delete/", { deck_id: deckId, ids });
    },
    addTermsToDeck(deckId: string, terms: Term[]): Promise<any> {
      const formData = new FormData();
      formData.append("deck_id", deckId);
      terms.forEach((term, index) => {
        const prefix = `terms[${index}]`;
        formData.append(`${prefix}[name]`, term.name ?? "");
        formData.append(`${prefix}[meaning]`, term.meaning ?? "");
        if (term.image) formData.append(`${prefix}[image]`, term.image as string);
        appendAiFields(formData, prefix, term);
      });
      return client.post("terms/add_terms/", formData);
    },
    updateTerms(terms: Term[]): Promise<any> {
      const formData = new FormData();
      terms.forEach((term, index) => {
        const prefix = `[${index}]`;
        formData.append(`${prefix}[id]`, term.id ?? "");
        formData.append(`${prefix}[name]`, term.name ?? "");
        formData.append(`${prefix}[meaning]`, term.meaning ?? "");
        if (term.image) formData.append(`${prefix}[image]`, term.image as string);
        appendAiFields(formData, prefix, term);
      });
      return client.put("terms/update_terms/", formData);
    },
    aiEnrich(name: string, meaning = ""): Promise<any> {
      return client.post("terms/ai_enrich/", { name, meaning }, aiConfig);
    },
    addToDefaultDeck(term: Term): Promise<any> {
      const payload: Record<string, unknown> = {
        name: term.name,
        meaning: term.meaning ?? "",
        word_type: term.word_type ?? "",
        pronunciation: term.pronunciation ?? "",
        definition: term.definition ?? "",
        synonyms: term.synonyms ?? [],
        antonyms: term.antonyms ?? [],
        examples: term.examples ?? [],
        word_forms: term.word_forms ?? [],
        word_family: term.word_family ?? [],
        ai_filled: term.ai_filled ?? true,
      };
      if (term.image) payload.image = term.image;
      return client.post("terms/add_to_default_deck/", payload);
    },
    delete(id: string): Promise<any> {
      return client.delete(`terms/${id}/`);
    },
  };
}

export type TermApi = ReturnType<typeof createTermApi>;

// ── Role ──────────────────────────────────────────────────────────────────

export function createRoleApi(client: AxiosInstance) {
  return {
    invite(token: string): Promise<any> {
      return client.get("roles/invite/", { params: { token } });
    },
  };
}

export type RoleApi = ReturnType<typeof createRoleApi>;

// ── Learning ──────────────────────────────────────────────────────────────

export function createLearningApi(client: AxiosInstance) {
  return {
    /** Registers a card view (matches web's `learningService.create`), used by Learn mode to track progress. */
    create(data: { term_id: string }): Promise<any> {
      return client.post("learnings/", data);
    },
    getLearningTerms(deckId: string, page: number): Promise<any> {
      return client.get("learnings/get_learning_terms/", {
        params: { deck_id: deckId, page },
      });
    },
    getLatestLearnedTerm(deckId: string, termId?: string): Promise<any> {
      return client.get("learnings/get_latest_learned_term/", {
        params: { deck_id: deckId, ...(termId ? { term_id: termId } : {}) },
      });
    },
    getReviseTerms(deckId: string): Promise<any> {
      return client.get("learnings/get_revise_terms/", {
        params: { deck_id: deckId },
      });
    },
    correct(id: string): Promise<any> {
      return client.put(`learnings/${id}/correct/`);
    },
    incorrect(id: string): Promise<any> {
      return client.put(`learnings/${id}/incorrect/`);
    },
    remember(id: string): Promise<any> {
      return client.put(`learnings/${id}/remember/`);
    },
    changePriority(id: string, point: number): Promise<any> {
      return client.put(`learnings/${id}/priority/`, { adjust_point: point });
    },
  };
}

export type LearningApi = ReturnType<typeof createLearningApi>;

// ── Competition ─────────────────────────────────────────────────────────────

export function createCompetitionApi(client: AxiosInstance) {
  return {
    // Random sample of full-field terms for building any mini-game client-side.
    getPool(deckId: string): Promise<any> {
      return client.get("competition/pool/", {
        params: { deck_id: deckId },
      });
    },
    getLeaderboard(deckId: string, gameKey: string): Promise<any> {
      return client.get("competition/leaderboard/", {
        params: { deck_id: deckId, game_key: gameKey },
      });
    },
    submitScore(deckId: string, gameKey: string, score: number): Promise<any> {
      return client.post("competition/submit_score/", {
        deck_id: deckId,
        game_key: gameKey,
        score,
      });
    },
  };
}

export type CompetitionApi = ReturnType<typeof createCompetitionApi>;

// ── Course ────────────────────────────────────────────────────────────────

export function createCourseApi(client: AxiosInstance, aiTimeout = 240000) {
  const aiConfig: AxiosRequestConfig = { timeout: aiTimeout };

  return {
    getCatalog(page = 1, level = ""): Promise<any> {
      const params = new URLSearchParams({ page: String(page) });
      if (level) params.set("level", level);
      return client.get(`courses/?${params.toString()}`);
    },
    getLevels(): Promise<any> {
      return client.get("courses/levels/");
    },
    deleteCourse(slug: string): Promise<any> {
      return client.delete(`courses/${slug}/`);
    },
    getCourse(slug: string): Promise<any> {
      return client.get(`courses/${slug}/`);
    },
    getLessonAudio(lessonId: string): Promise<any> {
      return client.get(`courses/lesson_audio/?lesson_id=${lessonId}`);
    },
    submitRolePlay(payload: {
      lessonId: string;
      segments: { target_text: string; audio: string; mime_type: string }[];
    }): Promise<any> {
      return client.post(
        "courses/role_play/",
        { lesson_id: payload.lessonId, segments: payload.segments },
        aiConfig
      );
    },
    submitDictation(payload: {
      lessonId: string;
      score: number;
      lines: unknown[];
    }): Promise<any> {
      return client.post("courses/dictation/", {
        lesson_id: payload.lessonId,
        score: payload.score,
        lines: payload.lines,
      });
    },
    setHighlight(
      lessonId: string,
      opts: { text: string; note?: string; remove?: boolean } = { text: "" }
    ): Promise<any> {
      return client.post("courses/highlight/", {
        lesson_id: lessonId,
        text: opts.text,
        note: opts.note ?? "",
        remove: opts.remove ?? false,
      });
    },
  };
}

export type CourseApi = ReturnType<typeof createCourseApi>;

// ── Listening ─────────────────────────────────────────────────────────────

export function createListeningApi(client: AxiosInstance) {
  return {
    getTopics(): Promise<any> {
      return client.get("listening/topics/");
    },
    getTopic(slug: string): Promise<any> {
      return client.get(`listening/${slug}/`);
    },
    getExercise(id: string): Promise<any> {
      return client.get(`listening/exercise/?id=${id}`);
    },
    submit(payload: {
      exerciseId: string;
      score: number;
      lines: unknown[];
    }): Promise<any> {
      return client.post("listening/submit/", {
        exercise_id: payload.exerciseId,
        score: payload.score,
        lines: payload.lines,
      });
    },
    saveProgress(payload: { exerciseId: string; lines: unknown[] }): Promise<any> {
      return client.post("listening/save_progress/", {
        exercise_id: payload.exerciseId,
        lines: payload.lines,
      });
    },
    resetProgress(exerciseId: string): Promise<any> {
      return client.post("listening/reset_progress/", {
        exercise_id: exerciseId,
      });
    },
    setHighlight(
      exerciseId: string,
      opts: { text: string; note?: string; remove?: boolean } = { text: "" }
    ): Promise<any> {
      return client.post("listening/highlight/", {
        exercise_id: exerciseId,
        text: opts.text,
        note: opts.note ?? "",
        remove: opts.remove ?? false,
      });
    },
    translate(payload: { text: string; targetLanguage?: string }): Promise<any> {
      return client.post("listening/translate/", {
        text: payload.text,
        target_language: payload.targetLanguage ?? "vi",
      });
    },
    saveSentenceMeta(
      exerciseId: string,
      opts: { position: number; translation?: string; note?: string }
    ): Promise<any> {
      const body: Record<string, unknown> = {
        exercise_id: exerciseId,
        position: opts.position,
      };
      if (opts.translation !== undefined) body.translation = opts.translation;
      if (opts.note !== undefined) body.note = opts.note;
      return client.post("listening/sentence_meta/", body);
    },
  };
}

export type ListeningApi = ReturnType<typeof createListeningApi>;

// ── Grammar ───────────────────────────────────────────────────────────────

export function createGrammarApi(client: AxiosInstance, aiTimeout = 240000) {
  const aiConfig: AxiosRequestConfig = { timeout: aiTimeout };

  return {
    getBooks(): Promise<any> {
      return client.get("grammar/books/");
    },
    getCatalog(bookSlug?: string): Promise<any> {
      return client.get("grammar/", bookSlug ? { params: { book: bookSlug } } : undefined);
    },
    getUnit(unitKey: string): Promise<any> {
      return client.get(`grammar/${unitKey}/`);
    },
    submitExercise(exerciseKey: string, submissions: unknown[]): Promise<any> {
      return client.post("grammar/submit_exercise/", {
        exercise_key: exerciseKey,
        submissions,
      });
    },
    clearUnitProgress(unitKey: string): Promise<any> {
      return client.post("grammar/clear_progress/", { unit_key: unitKey });
    },
    explain(payload: Record<string, unknown>): Promise<any> {
      return client.post("grammar/explain/", payload, aiConfig);
    },
    setHighlight(
      unitKey: string,
      opts: { text: string; note?: string; remove?: boolean } = { text: "" }
    ): Promise<any> {
      return client.post("grammar/highlight/", {
        unit_key: unitKey,
        text: opts.text,
        note: opts.note ?? "",
        remove: opts.remove ?? false,
      });
    },
  };
}

export type GrammarApi = ReturnType<typeof createGrammarApi>;

// ── Speaking ──────────────────────────────────────────────────────────────

export function createSpeakingApi(client: AxiosInstance, aiTimeout = 240000) {
  const aiConfig: AxiosRequestConfig = { timeout: aiTimeout };

  return {
    generateConversation(payload: Record<string, unknown>): Promise<any> {
      return client.post("speaking/generate_conversation/", payload, aiConfig);
    },
    suggestTopics(history: string[] = [], level?: string): Promise<any> {
      return client.post("speaking/suggest_topics/", { history, level }, aiConfig);
    },
    analyze(payload: {
      targetText: string;
      audio: string;
      mimeType?: string;
      kind?: string;
      conversationId?: string;
    }): Promise<any> {
      return client.post(
        "speaking/analyze/",
        {
          target_text: payload.targetText,
          audio: payload.audio,
          mime_type: payload.mimeType ?? "audio/webm",
          kind: payload.kind ?? "single",
          conversation_id: payload.conversationId,
        },
        aiConfig
      );
    },
    explainPhrase(text: string, context = ""): Promise<any> {
      return client.post("speaking/explain_phrase/", { text, context }, aiConfig);
    },
    generateSpeech(text: string, voice: string): Promise<any> {
      return client.post("speaking/speak/", { text, voice }, aiConfig);
    },
    getConversation(id: string): Promise<any> {
      return client.get(`speaking/${id}/`);
    },
    deleteConversation(id: string): Promise<any> {
      return client.delete(`speaking/${id}/`);
    },
    bulkDeleteConversations(ids: string[]): Promise<any> {
      return client.post("speaking/bulk_delete/", { ids });
    },
    setStar(id: string, starred: boolean): Promise<any> {
      return client.post(`speaking/${id}/star/`, { starred });
    },
    getVoices(): Promise<any> {
      return client.get("speaking/voices/");
    },
    matchTerms(arg: string | { texts: string[] }): Promise<any> {
      const payload =
        arg && typeof arg === "object"
          ? { texts: arg.texts }
          : { conversation_id: arg };
      return client.post("speaking/match_terms/", payload);
    },
    setHighlight(
      id: string,
      opts: { text: string; note?: string; remove?: boolean } = { text: "" }
    ): Promise<any> {
      return client.post(`speaking/${id}/highlight/`, {
        text: opts.text,
        note: opts.note ?? "",
        remove: opts.remove ?? false,
      });
    },
    getHistory(): Promise<any> {
      return client.get("speaking/history/");
    },
  };
}

export type SpeakingApi = ReturnType<typeof createSpeakingApi>;

// ── Writing ───────────────────────────────────────────────────────────────

export function createWritingApi(client: AxiosInstance, aiTimeout = 240000) {
  const aiConfig: AxiosRequestConfig = { timeout: aiTimeout };

  return {
    suggestTopics(history: string[] = [], level?: string): Promise<any> {
      return client.post("writing/suggest_topics/", { history, level }, aiConfig);
    },
    startChat(payload: { topic: string; level: string; tone: string }): Promise<any> {
      return client.post("writing/start_chat/", payload, aiConfig);
    },
    sendMessage(id: string, text: string): Promise<any> {
      return client.post(`writing/${id}/chat_message/`, { text }, aiConfig);
    },
    writingSupport(topic: string, level: string): Promise<any> {
      return client.post("writing/writing_support/", { topic, level }, aiConfig);
    },
    submitDraft(payload: {
      topic: string;
      draft: string;
      level: string;
      tone: string;
    }): Promise<any> {
      return client.post("writing/submit_draft/", payload, aiConfig);
    },
    explainPhrase(text: string, context = ""): Promise<any> {
      return client.post("writing/explain_phrase/", { text, context }, aiConfig);
    },
    matchTerms(arg: string | { texts: string[] }): Promise<any> {
      const payload =
        arg && typeof arg === "object"
          ? { texts: arg.texts }
          : { session_id: arg };
      return client.post("writing/match_terms/", payload);
    },
    setHighlight(
      id: string,
      opts: { text: string; note?: string; remove?: boolean } = { text: "" }
    ): Promise<any> {
      return client.post(`writing/${id}/highlight/`, {
        text: opts.text,
        note: opts.note ?? "",
        remove: opts.remove ?? false,
      });
    },
    getSession(id: string): Promise<any> {
      return client.get(`writing/${id}/`);
    },
    getHistory(): Promise<any> {
      return client.get("writing/history/");
    },
    deleteSession(id: string): Promise<any> {
      return client.delete(`writing/${id}/`);
    },
    bulkDeleteSessions(ids: string[]): Promise<any> {
      return client.post("writing/bulk_delete/", { ids });
    },
    setStar(id: string, starred: boolean): Promise<any> {
      return client.post(`writing/${id}/star/`, { starred });
    },
  };
}

export type WritingApi = ReturnType<typeof createWritingApi>;

// ── Revise (mixed session) ────────────────────────────────────────────────

export function createReviseApi(client: AxiosInstance, aiTimeout = 240000) {
  const aiConfig: AxiosRequestConfig = { timeout: aiTimeout };

  return {
    buildSession(size = 12): Promise<any> {
      return client.post("revise/session/", { size });
    },
    answer(cardId: string, given: unknown): Promise<any> {
      return client.post("revise/answer/", { card_id: cardId, given });
    },
    answerSpeaking(
      cardId: string,
      payload: { audio: string; mimeType: string }
    ): Promise<any> {
      return client.post(
        "revise/answer/",
        { card_id: cardId, audio: payload.audio, mime_type: payload.mimeType },
        aiConfig
      );
    },
  };
}

export type ReviseApi = ReturnType<typeof createReviseApi>;

// ── Images & Translate ────────────────────────────────────────────────────

export function createImageApi(client: AxiosInstance) {
  return {
    search(query: string, count = 10): Promise<any> {
      return client.post("images/", { query, count });
    },
  };
}

export type ImageApi = ReturnType<typeof createImageApi>;

export function createTranslateApi(client: AxiosInstance) {
  return {
    translate(text: string, targetLanguage = "vi", sourceLanguage = "auto"): Promise<any> {
      return client.post("translate/", {
        text,
        target_language: targetLanguage,
        source_language: sourceLanguage,
      });
    },
  };
}

export type TranslateApi = ReturnType<typeof createTranslateApi>;

// ── Notes (cross-feature study notes) ─────────────────────────────────────

/**
 * What a note image can be uploaded from: browser bytes, the URL of a picture
 * copied off a web page, or React Native's file descriptor for a picked asset.
 */
export type NoteImageSource = Blob | string | { uri: string; name: string; type: string };

export function createNoteApi(client: AxiosInstance) {
  return {
    /** The note for one target, or `{ note: null }` when nothing is written. */
    forTarget(
      targetType: NoteTargetType,
      targetKey: string
    ): Promise<AxiosResponse<{ note: Note | null }>> {
      return client.get("notes/for_target/", {
        params: { target_type: targetType, target_key: targetKey },
      });
    },
    /** Upsert the note for a target. An empty document deletes it. */
    save(
      targetType: NoteTargetType,
      targetKey: string,
      payload: { content: NoteDoc; title?: string; targetUrl?: string }
    ): Promise<AxiosResponse<{ note: Note | null }>> {
      return client.post("notes/", {
        target_type: targetType,
        target_key: targetKey,
        content: payload.content,
        title: payload.title ?? "",
        target_url: payload.targetUrl ?? "",
      });
    },
    remove(id: string): Promise<AxiosResponse<void>> {
      return client.delete(`notes/${id}/`);
    },
    /**
     * Host an image on our CDN and return its URL.
     *
     * Notes only store images we host, so an editor uploads first and inserts
     * the returned URL. Pass a `File`/`Blob` for pasted, dropped or picked
     * pictures, or a string for one copied from a web page — the server
     * re-hosts remote addresses so they cannot break or track the reader.
     */
    uploadImage(source: NoteImageSource): Promise<AxiosResponse<{ url: string }>> {
      if (typeof source === "string") {
        return client.post("notes/image/", { source_url: source });
      }
      const formData = new FormData();
      formData.append("image", source as unknown as Blob);
      return client.post("notes/image/", formData);
    },
  };
}

export type NoteApi = ReturnType<typeof createNoteApi>;

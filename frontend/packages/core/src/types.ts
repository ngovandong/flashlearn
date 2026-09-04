// Shared, platform-agnostic domain types used across web and native apps.

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  default_deck?: string | null;
  is_superuser?: boolean;
  [key: string]: unknown;
}

export interface TokenPair {
  access: string;
  refresh?: string;
}

export interface LoginPayload extends TokenPair {
  user?: AuthUser;
}

export type Role = "E" | "V" | "O";

export type QuestionType = "QUIZ" | "FILL";

export interface Term {
  id?: string;
  name?: string;
  meaning?: string;
  image?: string;
  learning_progress_id?: string;
  word_type?: string;
  pronunciation?: string;
  definition?: string;
  synonyms?: string[];
  antonyms?: string[];
  examples?: string[];
  word_forms?: string[];
  word_family?: string[];
  ai_filled?: boolean;
  [key: string]: unknown;
}

export interface Question {
  type: QuestionType;
  id?: string;
  image?: string;
  question?: string;
  options?: string[];
  answer?: string;
  progressId?: string;
}

export interface Reminder {
  type: string;
  route: string;
  label: string | null;
}

export interface LearningStreak {
  streak: number;
  studied_today: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface UserSummary {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
}

export interface LearningProgress {
  learned?: number;
  total?: number;
  percentage?: number;
  /** Terms actively being learned (score below mastery threshold). */
  learning?: number;
  /** Terms mastered / completed. */
  completed?: number;
  /** Terms not yet started. */
  left?: number;
  /** Terms revised today. */
  learned_today?: number;
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  is_public?: boolean;
  owner?: UserSummary;
  number_of_term?: number;
  created_at?: string;
  updated_at?: string;
  background?: string;
  learned?: number;
  my_permission?: Role;
}

export interface DeckUserRole {
  user: UserSummary;
  role: Role;
}

export interface DeckDetail extends Deck {
  user_roles?: DeckUserRole[];
  learning_progress?: LearningProgress;
}

export interface ReviseTermsResponse {
  revise_terms: Term[];
  all_terms: Term[];
  deck_name?: string;
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  level: string;
  description?: string;
  order?: number;
  total_lessons?: number;
  passed_lessons?: number;
}

export interface CourseLesson {
  id: string;
  key?: string;
  slug?: string;
  title: string;
  order?: number;
  progress?: {
    status?: string;
    best_score?: number;
  };
}

export interface CourseSection {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  order?: number;
  lessons?: CourseLesson[];
}

export interface CourseDetail extends CourseSummary {
  sections?: CourseSection[];
}

export interface ListeningTopic {
  id: string;
  slug: string;
  title: string;
  level?: string;
  description?: string;
  order?: number;
  total_exercises?: number;
  completed_exercises?: number;
}

export interface ListeningExerciseSummary {
  id: string;
  slug?: string;
  key?: string;
  title: string;
  level?: string;
  order?: number;
  sentence_count?: number;
  has_audio?: boolean;
  progress?: unknown;
}

export interface ListeningSentence {
  position: number;
  text?: string;
  tokens?: (string | string[])[];
  audio_url?: string;
  time_start?: number;
  time_end?: number;
  hint?: string;
  explanation?: string;
}

export interface GrammarBook {
  slug: string;
  title: string;
  level?: string;
  description?: string;
  source?: string;
  background?: string;
  total_units?: number;
  completed_units?: number;
}

export interface GrammarUnitSummary {
  key: string;
  slug?: string;
  number?: number;
  title: string;
  total_exercises?: number;
  completed_exercises?: number;
  status?: string;
  best_score?: number;
}

export interface GrammarExercise {
  id: string;
  key: string;
  slug?: string;
  title?: string;
  order?: number;
  kind?: string;
  prompt?: string;
  options?: string[];
  items?: unknown[];
  progress?: unknown;
}

export interface SpeakingConversation {
  id: string;
  topic?: string;
  level?: string;
  tone?: string;
  lines?: SpeakingLine[];
  starred?: boolean;
  created_at?: string;
  highlights?: Highlight[];
}

export interface SpeakingLine {
  id?: string;
  speaker?: string;
  text?: string;
  voice?: string;
}

export interface WritingSession {
  id: string;
  topic?: string;
  level?: string;
  tone?: string;
  mode?: string;
  messages?: WritingMessage[];
  draft?: string;
  feedback?: unknown;
  starred?: boolean;
  created_at?: string;
  highlights?: Highlight[];
}

export interface WritingMessage {
  id?: string;
  role?: string;
  text?: string;
}

export interface Highlight {
  text: string;
  note?: string;
}

export interface ReviseCard {
  id: string;
  kind: "vocab" | "grammar" | "listening" | "speaking";
  prompt?: string;
  payload?: Record<string, unknown>;
  seen_count?: number;
  mistake_count?: number;
}

export interface ReviseSession {
  cards: ReviseCard[];
  counts?: Record<string, number>;
}

export interface ReviseAnswerResult {
  correct: boolean;
  answer?: string;
  mastered?: boolean;
  correct_streak?: number;
  mistake_count?: number;
  score?: number;
  result?: unknown;
}

export interface QuickReviseQuestion {
  progressId?: string;
  question?: string;
  answer?: string;
  image?: string;
  options?: string[];
  type?: string;
}

export interface ImageSearchResult {
  urls?: string[];
}

export interface TranslateResult {
  translation?: string;
  provider?: string;
}

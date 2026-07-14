import {
  createCourseApi,
  createDeckApi,
  createGrammarApi,
  createImageApi,
  createLearningApi,
  createListeningApi,
  createReminderApi,
  createReviseApi,
  createRoleApi,
  createSpeakingApi,
  createTermApi,
  createTranslateApi,
  createUserSettingsApi,
  createWritingApi,
} from "@flashlearn/api";
import type { UserSettings } from "@flashlearn/api";
import { ENV } from "@/config/env";
import { request } from "@/api/client";

const aiTimeout = ENV.aiRequestTimeout;

export const reminderApi = createReminderApi(request);
export const userSettingsApi = createUserSettingsApi(request);
export const deckApi = createDeckApi(request);
export const termApi = createTermApi(request, aiTimeout);
export const roleApi = createRoleApi(request);
export const learningApi = createLearningApi(request);
export const courseApi = createCourseApi(request, aiTimeout);
export const listeningApi = createListeningApi(request);
export const grammarApi = createGrammarApi(request, aiTimeout);
export const speakingApi = createSpeakingApi(request, aiTimeout);
export const writingApi = createWritingApi(request, aiTimeout);
export const reviseApi = createReviseApi(request, aiTimeout);
export const imageApi = createImageApi(request);
export const translateApi = createTranslateApi(request);

export type { UserSettings };

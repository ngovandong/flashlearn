import {
  createAssistantApi,
  createCompetitionApi,
  createCourseApi,
  createDeckApi,
  createGrammarApi,
  createImageApi,
  createLearningApi,
  createListeningApi,
  createNoteApi,
  createReminderApi,
  createReviseApi,
  createRoleApi,
  createSpeakingApi,
  createTermApi,
  createTranslateApi,
  createUserSettingsApi,
  createWritingApi,
} from "@flashlearn/api";
import type { AssistantReply, UserSettings } from "@flashlearn/api";
import { ENV } from "@/config/env";
import { request } from "@/api/client";

const aiTimeout = ENV.aiRequestTimeout;

export const reminderApi = createReminderApi(request);
export const assistantApi = createAssistantApi(request, aiTimeout);
export const userSettingsApi = createUserSettingsApi(request);
export const deckApi = createDeckApi(request);
export const termApi = createTermApi(request, aiTimeout);
export const roleApi = createRoleApi(request);
export const learningApi = createLearningApi(request);
export const competitionApi = createCompetitionApi(request);
export const courseApi = createCourseApi(request, aiTimeout);
export const listeningApi = createListeningApi(request);
export const noteApi = createNoteApi(request);
export const grammarApi = createGrammarApi(request, aiTimeout);
export const speakingApi = createSpeakingApi(request, aiTimeout);
export const writingApi = createWritingApi(request, aiTimeout);
export const reviseApi = createReviseApi(request, aiTimeout);
export const imageApi = createImageApi(request);
export const translateApi = createTranslateApi(request);

export type { AssistantReply, UserSettings };

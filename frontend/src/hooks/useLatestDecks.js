import { useQuery } from "@tanstack/react-query";
import { deckService } from "@api-services/deckService";
import { userSettingService } from "@api-services/userSettingService";
import { getFirstError } from "@utils/errorHandler";

export function useLatestDecks() {
  return useQuery({
    queryKey: ["decks", "latest"],
    queryFn: async () => {
      const res = await deckService.getLatestDeck();
      if (res.error) {
        throw new Error(getFirstError(res.error));
      }
      return res.data;
    },
  });
}

export function usePublicDecks(enabled) {
  return useQuery({
    queryKey: ["decks", "public"],
    queryFn: async () => {
      const res = await deckService.getPublicDecks();
      if (res.error) {
        throw new Error(getFirstError(res.error));
      }
      return res.data;
    },
    enabled,
  });
}

export function useLearningStreak() {
  return useQuery({
    queryKey: ["user", "learningStreak"],
    queryFn: async () => {
      const res = await userSettingService.getLearningStreak();
      if (res.error) {
        throw new Error(getFirstError(res.error));
      }
      return res.data;
    },
  });
}

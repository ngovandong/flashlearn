import { useQuery } from "@tanstack/react-query";
import type { Deck } from "@flashlearn/core";
import { deckApi, reminderApi, userSettingsApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";

export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: () => reminderApi.getReminders(),
  });
}

export function useLearningStreak() {
  return useQuery({
    queryKey: ["learning-streak"],
    queryFn: () => userSettingsApi.getLearningStreak(),
  });
}

export function useLatestDecks() {
  return useQuery({
    queryKey: ["decks", "latest"],
    queryFn: async () => unwrap<Deck[]>(await deckApi.getLatestDecks()),
  });
}

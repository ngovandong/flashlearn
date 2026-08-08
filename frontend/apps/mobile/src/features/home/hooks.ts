import { useQuery } from "@tanstack/react-query";
import type { Deck } from "@flashlearn/core";
import { deckApi, reminderApi, userSettingsApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";
import { useAppSelector } from "@/store/hooks";
import { selectToken } from "@/store/authSlice";

// Every hook here is gated on `enabled: !!token` rather than relying on
// screen-mount timing to guarantee the token is already in Redux — Google
// sign-in's extra native-Activity + token-exchange hop can otherwise let a
// query fire before the access token is committed, sending an unauthenticated
// request (401 "Authentication credentials were not provided").
export function useReminders() {
  const token = useAppSelector(selectToken);
  return useQuery({
    queryKey: ["reminders"],
    queryFn: () => reminderApi.getReminders(),
    enabled: !!token,
  });
}

export function useLearningStreak() {
  const token = useAppSelector(selectToken);
  return useQuery({
    queryKey: ["learning-streak"],
    queryFn: () => userSettingsApi.getLearningStreak(),
    enabled: !!token,
  });
}

export function useLatestDecks() {
  const token = useAppSelector(selectToken);
  return useQuery({
    queryKey: ["decks", "latest"],
    queryFn: async () => unwrap<Deck[]>(await deckApi.getLatestDecks()),
    enabled: !!token,
  });
}

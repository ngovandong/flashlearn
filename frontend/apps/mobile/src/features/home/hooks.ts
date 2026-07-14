import { useQuery } from "@tanstack/react-query";
import { reminderApi } from "@/api/services";
import { userSettingsApi } from "@/api/services";

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

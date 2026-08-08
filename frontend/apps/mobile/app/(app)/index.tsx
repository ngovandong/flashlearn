import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Snackbar, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mapReminderRoute, REMINDER_META, type Reminder } from "@flashlearn/core";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/authSlice";
import { useLatestDecks, useReminders } from "@/features/home/hooks";
import { StreakCard } from "@/components/StreakCard";
import { DeckCard } from "@/components/DeckCard";
import { ReminderList, ReminderListSkeleton } from "@/components/ReminderList";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { AppCard } from "@/components/ui/AppCard";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { motion, useTokens } from "@/theme/tokens";

export default function HomeScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useFloatingTabBarHeight();
  const user = useAppSelector(selectUser);
  const {
    data: reminders,
    isLoading: remindersLoading,
    error: remindersError,
  } = useReminders();
  const {
    data: latestDecks,
    isLoading: decksLoading,
    error: decksError,
  } = useLatestDecks();
  const [snack, setSnack] = useState<string | null>(null);

  const greetingName = user?.name || user?.first_name || "there";

  // Surface query failures the same way the web dashboard does (an error
  // snackbar) instead of silently showing an empty section.
  useEffect(() => {
    const message = (decksError as Error)?.message || (remindersError as Error)?.message;
    if (message) setSnack(message);
  }, [decksError, remindersError]);

  const onReminderPress = (reminder: Reminder) => {
    const nativePath = mapReminderRoute(reminder.route);
    if (nativePath) {
      router.push(nativePath as any);
      return;
    }
    const title = REMINDER_META[reminder.type]?.title ?? "That activity";
    setSnack(`${title} is not available yet.`);
  };

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
      >
        <FadeSlideIn>
          <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
            Welcome back
          </Text>
          <Text
            variant="headlineMedium"
            style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}
          >
            Hi, {greetingName} 👋
          </Text>
        </FadeSlideIn>

        <FadeSlideIn delay={60} style={styles.section}>
          <StreakCard />
        </FadeSlideIn>

        <FadeSlideIn delay={120} style={styles.section}>
          <SectionHeader title="Jump back in" subtitle="Pick up where you left off" />
          {remindersLoading ? (
            <ReminderListSkeleton />
          ) : (
            <ReminderList reminders={reminders ?? []} onPress={onReminderPress} />
          )}
        </FadeSlideIn>

        {decksLoading || (latestDecks && latestDecks.length > 0) ? (
          <View style={styles.section}>
            <FadeSlideIn delay={180}>
              <SectionHeader
                title="Recent decks"
                action="See all"
                onAction={() => router.push("/library")}
              />
            </FadeSlideIn>
            {decksLoading ? (
              <View style={{ gap: 12 }}>
                {[0, 1].map((i) => (
                  <AppCard key={i}>
                    <View style={styles.deckSkeletonRow}>
                      <Skeleton width={48} height={48} radius={14} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="60%" height={16} />
                        <Skeleton width="40%" height={12} />
                      </View>
                    </View>
                  </AppCard>
                ))}
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {(latestDecks ?? []).slice(0, 4).map((deck, i) => (
                  <FadeSlideIn key={deck.id} delay={220 + i * motion.stagger.list}>
                    <DeckCard
                      deck={deck}
                      onPress={() => router.push(`/library/${deck.id}`)}
                    />
                  </FadeSlideIn>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 110, gap: 8 },
  section: { gap: 12, marginTop: 8 },
  deckSkeletonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});

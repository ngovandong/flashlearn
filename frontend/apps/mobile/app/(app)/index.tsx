import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Snackbar, Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { mapReminderRoute, REMINDER_META, type Reminder } from "@flashlearn/core";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/authSlice";
import { useReminders } from "@/features/home/hooks";
import { StreakCard } from "@/components/StreakCard";
import { ReminderList } from "@/components/ReminderList";
import { ChatPanel } from "@/features/assistant/ChatPanel";

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const { data: reminders } = useReminders();
  const [snack, setSnack] = useState<string | null>(null);

  const greetingName = user?.name || user?.first_name || "there";

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
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Hi, {greetingName} 👋
        </Text>

        <StreakCard />

        <Text variant="titleMedium" style={{ color: theme.colors.onBackground, marginTop: 8 }}>
          Jump back in
        </Text>
        <ReminderList reminders={reminders ?? []} onPress={onReminderPress} />

        <Text variant="titleMedium" style={{ color: theme.colors.onBackground, marginTop: 8 }}>
          Ask Dragon
        </Text>
        <ChatPanel />
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 14 },
});

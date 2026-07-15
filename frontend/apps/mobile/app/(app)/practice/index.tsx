import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { List, Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

const ITEMS = [
  { title: "Mixed revise", subtitle: "Words, grammar, listening & speaking", icon: "auto-awesome", route: "/revise" },
  { title: "Courses", subtitle: "Speaking dialogues & lessons", icon: "menu-book", route: "/courses" },
  { title: "Listening", subtitle: "Dictation & number drills", icon: "headphones", route: "/listening" },
  { title: "Grammar", subtitle: "Rules & exercises", icon: "spellcheck", route: "/grammar" },
  { title: "Speaking coach", subtitle: "AI conversation practice", icon: "record-voice-over", route: "/speaking" },
  { title: "Writing coach", subtitle: "Drafts & chat feedback", icon: "edit-note", route: "/writing" },
] as const;

export default function PracticeHubScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Practice
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Pick a skill to train
        </Text>
      </View>
      {ITEMS.map((item) => (
        <List.Item
          key={item.route}
          title={item.title}
          description={item.subtitle}
          onPress={() => router.push(item.route as any)}
          left={() => (
            <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialIcons name={item.icon as any} size={22} color={theme.colors.primary} />
            </View>
          )}
          right={() => <List.Icon icon="chevron-right" />}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, gap: 4 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    alignSelf: "center",
  },
});

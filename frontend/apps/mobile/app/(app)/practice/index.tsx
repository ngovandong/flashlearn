import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { useTokens } from "@/theme/tokens";

const ITEMS = [
  { title: "Mixed revise", subtitle: "Words, grammar, listening & speaking", icon: "auto-awesome", route: "/revise" },
  { title: "Courses", subtitle: "Speaking dialogues & lessons", icon: "menu-book", route: "/courses" },
  { title: "Listening", subtitle: "Dictation & number drills", icon: "headphones", route: "/listening" },
  { title: "Grammar", subtitle: "Rules & exercises", icon: "spellcheck", route: "/grammar" },
  { title: "Speaking coach", subtitle: "AI conversation practice", icon: "record-voice-over", route: "/speaking" },
  { title: "Writing coach", subtitle: "Drafts & chat feedback", icon: "edit-note", route: "/writing" },
] as const;

export default function PracticeHubScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: t.neutral.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <FadeSlideIn>
        <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
          Train a skill
        </Text>
        <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}>
          Practice
        </Text>
      </FadeSlideIn>

      <View style={styles.list}>
        {ITEMS.map((item, i) => (
          <FadeSlideIn key={item.route} delay={i * 60}>
            <AppCard onPress={() => router.push(item.route as any)}>
              <View style={styles.row}>
                <FeatureTile icon={item.icon} />
                <View style={styles.body}>
                  <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "700" }}>
                    {item.title}
                  </Text>
                  <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 2 }}>
                    {item.subtitle}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={t.neutral.textMuted} />
              </View>
            </AppCard>
          </FadeSlideIn>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110, gap: 8 },
  list: { gap: 12, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  body: { flex: 1 },
});

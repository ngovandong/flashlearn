import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { REMINDER_META, type Reminder } from "@flashlearn/core";
import { reminderIconName } from "@/theme/reminderIcons";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { Skeleton } from "@/components/ui/Skeleton";
import { motion, useTokens } from "@/theme/tokens";

interface Props {
  reminders: Reminder[];
  onPress: (reminder: Reminder) => void;
}

export function ReminderList({ reminders, onPress }: Props) {
  const t = useTokens();
  const known = reminders.filter((r) => REMINDER_META[r.type]);

  if (known.length === 0) return null;

  return (
    <View style={styles.list}>
      {known.map((reminder, i) => {
        const meta = REMINDER_META[reminder.type];
        const iconName = reminderIconName(meta.icon);
        const { fg } = t.feature(iconName);

        return (
          <FadeSlideIn key={reminder.type} delay={i * motion.stagger.list}>
            <AppCard
              onPress={() => onPress(reminder)}
              style={{
                backgroundColor: t.tintSurface(fg, 0.07),
                borderColor: t.alpha(fg, 0.22),
              }}
            >
              <View style={styles.row}>
                <FeatureTile icon={iconName} variant="soft" />
                <View style={styles.body}>
                  <Text
                    variant="titleMedium"
                    style={{ color: t.neutral.text, fontWeight: "700" }}
                  >
                    {meta.title}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: t.neutral.textMinor, marginTop: 2 }}
                    numberOfLines={2}
                  >
                    {meta.description(reminder.label)}
                  </Text>
                  <View style={styles.cta}>
                    <Text style={{ color: fg, fontWeight: "700" }}>{meta.cta}</Text>
                    <MaterialIcons name="arrow-forward" size={16} color={fg} />
                  </View>
                </View>
              </View>
            </AppCard>
          </FadeSlideIn>
        );
      })}
    </View>
  );
}

/** Shimmering placeholder for the reminder list while it loads. */
export function ReminderListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <FadeSlideIn key={i} delay={i * motion.stagger.list}>
          <AppCard>
            <View style={styles.row}>
              <Skeleton width={48} height={48} radius={14} />
              <View style={styles.body}>
                <Skeleton width="55%" height={16} />
                <Skeleton width="90%" height={12} style={{ marginTop: 8 }} />
                <Skeleton width="30%" height={12} style={{ marginTop: 12 }} />
              </View>
            </View>
          </AppCard>
        </FadeSlideIn>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  body: { flex: 1 },
  cta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
});

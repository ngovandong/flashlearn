import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { REMINDER_META, type Reminder } from "@flashlearn/core";
import { reminderIconName, reminderToneColor } from "@/theme/reminderIcons";

interface Props {
  reminders: Reminder[];
  onPress: (reminder: Reminder) => void;
}

export function ReminderList({ reminders, onPress }: Props) {
  const theme = useTheme();
  const known = reminders.filter((r) => REMINDER_META[r.type]);

  if (known.length === 0) return null;

  return (
    <View style={styles.list}>
      {known.map((reminder) => {
        const meta = REMINDER_META[reminder.type];
        const tint = reminderToneColor(meta.tone, theme);
        return (
          <Pressable key={reminder.type} onPress={() => onPress(reminder)}>
            <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
              <Card.Content style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: tint }]}>
                  <MaterialIcons
                    name={reminderIconName(meta.icon) as any}
                    size={22}
                    color={theme.colors.onPrimary}
                  />
                </View>
                <View style={styles.body}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                    {meta.title}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                    numberOfLines={2}
                  >
                    {meta.description(reminder.label)}
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={theme.colors.onSurfaceVariant}
                />
              </Card.Content>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
});

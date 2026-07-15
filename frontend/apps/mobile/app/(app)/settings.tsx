import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import {
  Button,
  Divider,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  Snackbar,
  useTheme,
} from "react-native-paper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PALETTES, type ThemeMode } from "@flashlearn/core";
import { userSettingsApi, type UserSettings } from "@/api/services";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useAppDispatch } from "@/store/hooks";
import { logoutUser } from "@/store/authSlice";

export default function SettingsScreen() {
  const theme = useTheme();
  const { mode, palette, setMode, setPalette } = useAppTheme();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["my-settings"],
    queryFn: () => userSettingsApi.getSettings(),
  });

  const [dailyReminder, setDailyReminder] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setDailyReminder(!!settings.daily_reminder);
      setReminderEmail(settings.reminder_email ?? "");
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: Partial<UserSettings>) => userSettingsApi.updateSettings(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["my-settings"], updated);
      setSnack("Settings saved");
    },
    onError: () => setSnack("Couldn't save settings"),
  });

  const save = () => {
    mutation.mutate({
      daily_reminder: dailyReminder,
      reminder_email: reminderEmail,
      theme_mode: mode,
      theme_palette: palette,
    });
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
          Appearance
        </Text>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as ThemeMode)}
          buttons={[
            { value: "light", label: "Light", icon: "white-balance-sunny" },
            { value: "dark", label: "Dark", icon: "weather-night" },
            { value: "system", label: "System", icon: "cellphone" },
          ]}
        />

        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Color palette
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.palettes}>
          {PALETTES.map((p) => {
            const selected = p.id === palette;
            return (
              <Pressable key={p.id} onPress={() => setPalette(p.id)}>
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: p.primary,
                      borderColor: selected ? theme.colors.onBackground : "transparent",
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <Divider style={styles.divider} />

        <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
          Daily reminders
        </Text>
        <View style={styles.switchRow}>
          <Text style={{ color: theme.colors.onSurface, flex: 1 }}>
            Email me a daily study reminder
          </Text>
          <Switch value={dailyReminder} onValueChange={setDailyReminder} />
        </View>
        <TextInput
          mode="outlined"
          label="Reminder email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={reminderEmail}
          onChangeText={setReminderEmail}
          disabled={!dailyReminder}
        />
        <Button
          mode="contained"
          loading={mutation.isPending}
          onPress={save}
          style={styles.save}
        >
          Save settings
        </Button>

        <Divider style={styles.divider} />

        <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
          Account
        </Text>
        <Button mode="outlined" icon="logout" onPress={() => dispatch(logoutUser())}>
          Log out
        </Button>
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12 },
  palettes: { gap: 12, paddingVertical: 4 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
  },
  divider: { marginVertical: 8 },
  switchRow: { flexDirection: "row", alignItems: "center" },
  save: { marginTop: 8 },
});

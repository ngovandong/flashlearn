import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import {
  Button,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  Snackbar,
} from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CATEGORY_ORDER,
  PALETTE_CATEGORIES,
  type Palette,
  type ThemeMode,
  type ThemeSurface,
} from "@flashlearn/core";
import { userSettingsApi, type UserSettings } from "@/api/services";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useAppDispatch } from "@/store/hooks";
import { logoutUser } from "@/store/authSlice";
import { AppCard } from "@/components/ui/AppCard";
import { GradientSurface } from "@/components/ui/GradientSurface";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { useTokens, type Tokens } from "@/theme/tokens";
import { ASSISTANT_NAME } from "@/features/assistant/constants";
import { assistantPrefs, useAssistantPrefs } from "@/features/assistant/prefs";

function formatSnooze(until: number): string {
  const d = new Date(until);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

function PaletteSwatch({
  palette,
  selected,
  onSelect,
  t,
}: {
  palette: Palette;
  selected: boolean;
  onSelect: (id: string) => void;
  t: Tokens;
}) {
  return (
    <Pressable
      onPress={() => onSelect(palette.id)}
      style={[
        styles.swatchItem,
        {
          borderRadius: t.radii.md,
          borderColor: selected ? t.palette.primary : t.neutral.border,
          backgroundColor: selected ? t.primaryAlpha(0.08) : "transparent",
        },
      ]}
    >
      <GradientSurface colors={palette.gradient} style={styles.chip}>
        {selected ? (
          <MaterialIcons name="check" size={16} color={palette.onPrimary} />
        ) : null}
      </GradientSurface>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: selected ? t.palette.primary : t.neutral.text,
          fontWeight: selected ? "800" : "600",
        }}
      >
        {palette.name}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const t = useTokens();
  const tabBarHeight = useFloatingTabBarHeight();
  const { mode, palette, surface, setMode, setPalette, setSurface } = useAppTheme();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const assistant = useAssistantPrefs();
  const assistantSnoozed =
    assistant.snoozeUntil != null && Date.now() < assistant.snoozeUntil;

  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
  } = useQuery({
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

  useEffect(() => {
    if (settingsError) setSnack("Couldn't load settings");
  }, [settingsError]);

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
    });
  };

  // Mirrors web's themeContext `persist`: appearance changes apply instantly
  // to the UI (via useAppTheme/AsyncStorage) and are pushed to the server in
  // the background, independent of the reminders "Save settings" button, so
  // the choice follows the user across devices even if they never tap Save.
  const persistTheme = (data: Partial<UserSettings>) => {
    userSettingsApi.updateSettings(data).catch(() => {});
  };

  const handleMode = (v: ThemeMode) => {
    setMode(v);
    persistTheme({ theme_mode: v });
  };

  const handleSurface = (v: ThemeSurface) => {
    setSurface(v);
    persistTheme({ theme_surface: v });
  };

  const handlePalette = (id: string) => {
    setPalette(id);
    persistTheme({ theme_palette: id });
  };

  const handleLogout = () => {
    queryClient.clear();
    dispatch(logoutUser());
  };

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]} showsVerticalScrollIndicator={false}>
        <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
          Settings
        </Text>

        <AppCard padding={16} style={styles.card}>
          <Text variant="titleMedium" style={[styles.cardTitle, { color: t.neutral.text }]}>
            Appearance
          </Text>
          <SegmentedButtons
            value={mode}
            onValueChange={(v) => handleMode(v as ThemeMode)}
            buttons={[
              { value: "light", label: "Light", icon: "white-balance-sunny" },
              { value: "dark", label: "Dark", icon: "weather-night" },
              { value: "system", label: "System", icon: "cellphone" },
            ]}
          />

          <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 14 }}>
            Surface style
          </Text>
          <SegmentedButtons
            value={surface}
            onValueChange={(v) => handleSurface(v as ThemeSurface)}
            style={{ marginTop: 6 }}
            buttons={[
              { value: "solid", label: "Solid", icon: "square-rounded" },
              { value: "glass", label: "Liquid Glass", icon: "blur" },
            ]}
          />

          <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 14 }}>
            Color theme
          </Text>
          <Text variant="bodySmall" style={{ color: t.neutral.textMuted, marginTop: 2 }}>
            Pick an accent palette — it applies across the whole app instantly.
          </Text>

          {CATEGORY_ORDER.map((category) => (
            <View key={category} style={styles.group}>
              <Text style={[styles.groupTitle, { color: t.neutral.textMuted }]}>
                {category.toUpperCase()}
              </Text>
              <View style={styles.grid}>
                {(PALETTE_CATEGORIES[category] ?? []).map((p) => (
                  <PaletteSwatch
                    key={p.id}
                    palette={p}
                    selected={p.id === palette}
                    onSelect={handlePalette}
                    t={t}
                  />
                ))}
              </View>
            </View>
          ))}
        </AppCard>

        <AppCard padding={16} style={styles.card}>
          <Text variant="titleMedium" style={[styles.cardTitle, { color: t.neutral.text }]}>
            Daily reminders
          </Text>
          <View style={styles.switchRow}>
            <Text style={{ color: t.neutral.text, flex: 1 }}>
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
            style={{ marginTop: 12 }}
          />
          <Button
            mode="contained"
            loading={mutation.isPending}
            disabled={settingsLoading}
            onPress={save}
            style={styles.save}
          >
            Save settings
          </Button>
        </AppCard>

        <AppCard padding={16} style={styles.card}>
          <Text variant="titleMedium" style={[styles.cardTitle, { color: t.neutral.text }]}>
            Study buddy
          </Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.neutral.text }}>Show {ASSISTANT_NAME} assistant</Text>
              <Text variant="bodySmall" style={{ color: t.neutral.textMuted, marginTop: 2 }}>
                Drag it anywhere; long-press it to snooze.
              </Text>
            </View>
            <Switch
              value={!assistant.hidden}
              onValueChange={(v) => assistantPrefs.set({ hidden: !v })}
            />
          </View>

          {!assistant.hidden && assistantSnoozed && (
            <View style={styles.switchRow}>
              <Text style={{ color: t.neutral.textMinor, flex: 1 }}>
                Snoozed until {formatSnooze(assistant.snoozeUntil!)}
              </Text>
              <Button compact onPress={() => assistantPrefs.set({ snoozeUntil: null })}>
                Show now
              </Button>
            </View>
          )}

          {!assistant.hidden && assistant.position && (
            <Button
              mode="text"
              icon="restart"
              compact
              onPress={() => assistantPrefs.set({ position: null })}
              style={{ alignSelf: "flex-start", marginTop: 4 }}
            >
              Reset position
            </Button>
          )}
        </AppCard>

        <AppCard padding={16} style={styles.card}>
          <Text variant="titleMedium" style={[styles.cardTitle, { color: t.neutral.text }]}>
            Account
          </Text>
          <Button mode="outlined" icon="logout" onPress={handleLogout}>
            Log out
          </Button>
        </AppCard>
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 110 },
  card: { gap: 4 },
  cardTitle: { fontWeight: "800", marginBottom: 10 },
  group: { marginTop: 12 },
  groupTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  swatchItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderWidth: 1.5,
  },
  chip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  switchRow: { flexDirection: "row", alignItems: "center" },
  save: { marginTop: 14 },
});

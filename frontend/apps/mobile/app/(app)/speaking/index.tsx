import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Menu, Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { speakingApi } from "@/api/services";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { NavCard } from "@/components/ui/NavCard";
import { PillTabs } from "@/components/ui/PillTabs";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { playSpeechClip } from "@/utils/audio";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

const ACCENTS = [
  { id: "US", label: "American" },
  { id: "UK", label: "British" },
  { id: "AU", label: "Australian" },
];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const TONES = [
  { id: "casual", label: "Casual" },
  { id: "formal", label: "Formal" },
  { id: "professional", label: "Professional" },
  { id: "humorous", label: "Humorous" },
  { id: "academic", label: "Academic" },
];
const TURNS = [4, 6, 8, 10, 12];
const FALLBACK_TOPICS = ["Ordering Coffee", "Job Interview", "Airport Check-in"];
const DEFAULT_VOICE = "Kore";

interface Voice {
  id: string;
  label: string;
  accent?: string;
}
interface VoicesResponse {
  voices?: Voice[];
  legacy_voices?: Voice[];
  accent_defaults?: Record<string, string>;
  default?: string;
}

/** Rounded pill used across the setup form for single-select option rows. */
function Pill({
  label,
  active,
  onPress,
  t,
  minWidth,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  t: Tokens;
  minWidth?: number;
}) {
  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.pill,
        {
          minWidth,
          backgroundColor: active ? t.palette.primary : t.neutral.surface2,
          borderRadius: t.radii.pill,
        },
      ]}
    >
      <Text style={{ color: active ? t.palette.onPrimary : t.neutral.textMinor, fontWeight: active ? "800" : "600" }}>
        {label}
      </Text>
    </PressableScale>
  );
}

function FieldLabel({ children, t }: { children: React.ReactNode; t: Tokens }) {
  return (
    <Text variant="bodySmall" style={{ color: t.neutral.textMinor, fontWeight: "700", marginTop: 16, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

export default function SpeakingScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"topic" | "custom">("topic");
  const [vocabMode, setVocabMode] = useState(false);
  const [topic, setTopic] = useState("");
  const [customText, setCustomText] = useState("");
  const [accent, setAccent] = useState("US");
  const [level, setLevel] = useState("B1");
  const [tone, setTone] = useState("casual");
  const [turns, setTurns] = useState(6);
  const [userName, setUserName] = useState("Me");
  const [partnerName, setPartnerName] = useState("Coach");
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [voiceMenu, setVoiceMenu] = useState(false);
  const [toneMenu, setToneMenu] = useState(false);
  const [demoing, setDemoing] = useState(false);

  const voicesQuery = useQuery({
    queryKey: ["speaking", "voices"],
    queryFn: async () => unwrap<VoicesResponse>(await speakingApi.getVoices()),
  });

  const topicsQuery = useQuery({
    queryKey: ["speaking", "topics", level],
    queryFn: async () => unwrap<{ topics?: string[] }>(await speakingApi.suggestTopics([], level)),
  });

  const historyQuery = useQuery({
    queryKey: ["speaking", "history"],
    queryFn: async () => unwrap<{ conversations: { id: string; topic?: string }[] }>(await speakingApi.getHistory()),
  });

  const voicesData = voicesQuery.data;
  const accentDefaults = voicesData?.accent_defaults ?? {};

  // Default the voice to the active provider's pick for this accent.
  useEffect(() => {
    const next = accentDefaults[accent] ?? voicesData?.default;
    if (next) setSelectedVoice(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, voicesData]);

  const voiceOptions: Voice[] = (() => {
    const all = voicesData?.voices ?? [];
    const opts = all.filter((v) => !v.accent || v.accent === accent);
    if (selectedVoice && !opts.some((v) => v.id === selectedVoice)) {
      const known = all.find((v) => v.id === selectedVoice);
      opts.unshift(known ?? { id: selectedVoice, label: selectedVoice });
    }
    return opts.length ? opts : [{ id: DEFAULT_VOICE, label: "Kore — Warm & clear" }];
  })();

  const selectedVoiceLabel =
    voiceOptions.find((v) => v.id === selectedVoice)?.label ?? selectedVoice;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const useVocab = mode === "topic" && vocabMode;
      const res = await speakingApi.generateConversation({
        topic: useVocab ? "" : topic,
        accent,
        user_name: userName,
        partner_name: partnerName,
        custom_text: mode === "custom" ? customText : undefined,
        level,
        tone,
        turns,
        voice: selectedVoice,
        use_vocabulary: useVocab,
      });
      return unwrap<{ id: string; lines?: unknown[] }>(res);
    },
    onSuccess: (data) => {
      if (data?.id) router.push(`/speaking/${data.id}`);
    },
  });

  const previewVoice = async (voice: string) => {
    setDemoing(true);
    try {
      const clip = unwrap<{ audio_url?: string; audio?: string; mime_type?: string }>(
        await speakingApi.generateSpeech("Hi! This is how I sound. Let's practice speaking together.", voice)
      );
      await playSpeechClip({ audio_url: clip.audio_url, audio: clip.audio, mime_type: clip.mime_type });
    } catch {
      /* ignore preview failures */
    } finally {
      setDemoing(false);
    }
  };

  const suggestedTopics = topicsQuery.data?.topics?.length ? topicsQuery.data.topics : FALLBACK_TOPICS;
  const history = (historyQuery.data?.conversations ?? []).slice(0, 5);
  const canGenerate =
    !generateMutation.isPending &&
    (mode === "custom" ? customText.trim().length > 0 : vocabMode || topic.trim().length > 0);

  if (voicesQuery.isLoading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: t.neutral.bg }]}>
        <ActivityIndicator color={t.palette.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.neutral.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <FadeSlideIn>
        <PressableScale onPress={() => router.back()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={22} color={t.neutral.textMinor} />
          <Text style={{ color: t.neutral.textMinor, fontWeight: "700" }}>Back</Text>
        </PressableScale>
        <View style={[styles.brandRow, { marginTop: 8 }]}>
          <FeatureTile icon="record-voice-over" size={46} variant="solid" />
          <View style={{ flex: 1 }}>
            <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800" }}>
              Speaking Coach
            </Text>
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor }}>
              AI conversation & pronunciation practice
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 14 }}>
          <PillTabs
            value="practice"
            onChange={(v) => {
              if (v === "history") router.push("/speaking/history");
            }}
            options={[
              { value: "practice", label: "Practice" },
              { value: "history", label: "History" },
            ]}
          />
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={60}>
        <AppCard padding={16}>
          <PillTabs
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { value: "topic", label: "AI topic" },
              { value: "custom", label: "Custom text" },
            ]}
          />

          {mode === "topic" ? (
            <>
              <PressableScale
                onPress={() => setVocabMode((v) => !v)}
                style={[
                  styles.vocabRow,
                  {
                    backgroundColor: vocabMode ? t.primaryAlpha(0.12) : t.neutral.surface2,
                    borderRadius: t.radii.md,
                    marginTop: 14,
                  },
                ]}
              >
                <FeatureTile icon="auto-stories" size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ color: t.neutral.text, fontWeight: "700" }}>
                    Practice my vocabulary
                  </Text>
                  <Text variant="bodySmall" style={{ color: t.neutral.textMinor }}>
                    Build a dialogue around words you've saved
                  </Text>
                </View>
                <View
                  style={[
                    styles.statePill,
                    { backgroundColor: vocabMode ? t.palette.primary : t.neutral.border, borderRadius: t.radii.pill },
                  ]}
                >
                  <Text style={{ color: vocabMode ? t.palette.onPrimary : t.neutral.textMinor, fontWeight: "800", fontSize: 12 }}>
                    {vocabMode ? "ON" : "OFF"}
                  </Text>
                </View>
              </PressableScale>

              <FieldLabel t={t}>Conversation topic</FieldLabel>
              <TextInput
                mode="outlined"
                value={topic}
                disabled={vocabMode}
                onChangeText={setTopic}
                placeholder="e.g. Asking for directions, Checking in"
              />
              {vocabMode ? (
                <Text variant="bodySmall" style={{ color: t.neutral.textMuted, marginTop: 8 }}>
                  A topic and title will be chosen for you from your saved words.
                </Text>
              ) : (
                <View style={styles.chipWrap}>
                  {suggestedTopics.map((s) => (
                    <Pill key={s} label={s} active={topic === s} onPress={() => setTopic(s)} t={t} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <FieldLabel t={t}>Your dialogue text</FieldLabel>
              <TextInput
                mode="outlined"
                value={customText}
                onChangeText={setCustomText}
                multiline
                numberOfLines={5}
                placeholder="Paste sentences — the AI turns them into practice lines."
              />
            </>
          )}

          <FieldLabel t={t}>Accent</FieldLabel>
          <View style={styles.chipWrap}>
            {ACCENTS.map((a) => (
              <Pill key={a.id} label={a.label} active={accent === a.id} onPress={() => setAccent(a.id)} t={t} />
            ))}
          </View>

          <FieldLabel t={t}>Conversation tone</FieldLabel>
          <Menu
            visible={toneMenu}
            onDismiss={() => setToneMenu(false)}
            anchor={
              <PressableScale
                onPress={() => setToneMenu(true)}
                style={[styles.select, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}
              >
                <Text style={{ color: t.neutral.text, fontWeight: "600", flex: 1 }}>
                  {TONES.find((x) => x.id === tone)?.label}
                </Text>
                <MaterialIcons name="expand-more" size={22} color={t.neutral.textMuted} />
              </PressableScale>
            }
          >
            {TONES.map((x) => (
              <Menu.Item key={x.id} title={x.label} onPress={() => { setTone(x.id); setToneMenu(false); }} />
            ))}
          </Menu>

          <FieldLabel t={t}>Proficiency level</FieldLabel>
          <View style={styles.chipWrap}>
            {LEVELS.map((l) => (
              <Pill key={l} label={l} active={level === l} onPress={() => setLevel(l)} t={t} minWidth={48} />
            ))}
          </View>

          <FieldLabel t={t}>Conversation length</FieldLabel>
          <View style={styles.chipWrap}>
            {TURNS.map((n) => (
              <Pill key={n} label={`${n} turns`} active={turns === n} onPress={() => setTurns(n)} t={t} />
            ))}
          </View>

          <View style={styles.namesRow}>
            <View style={{ flex: 1 }}>
              <FieldLabel t={t}>Your name</FieldLabel>
              <TextInput mode="outlined" value={userName} onChangeText={setUserName} dense />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel t={t}>Coach name</FieldLabel>
              <TextInput mode="outlined" value={partnerName} onChangeText={setPartnerName} dense />
            </View>
          </View>

          <FieldLabel t={t}>Reference tutor voice</FieldLabel>
          <View style={styles.voiceRow}>
            <Menu
              visible={voiceMenu}
              onDismiss={() => setVoiceMenu(false)}
              anchor={
                <PressableScale
                  onPress={() => setVoiceMenu(true)}
                  style={[styles.select, styles.voiceSelect, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}
                >
                  <Text numberOfLines={1} style={{ color: t.neutral.text, fontWeight: "600", flex: 1 }}>
                    {selectedVoiceLabel}
                  </Text>
                  <MaterialIcons name="expand-more" size={22} color={t.neutral.textMuted} />
                </PressableScale>
              }
            >
              {voiceOptions.map((v) => (
                <Menu.Item
                  key={v.id}
                  title={v.label}
                  onPress={() => { setSelectedVoice(v.id); setVoiceMenu(false); }}
                />
              ))}
            </Menu>
            <PressableScale
              onPress={() => previewVoice(selectedVoice)}
              style={[styles.demoBtn, { borderColor: t.neutral.border }]}
            >
              <MaterialIcons name="volume-up" size={18} color={t.palette.primary} />
              <Text style={{ color: t.palette.primary, fontWeight: "700" }}>{demoing ? "Playing" : "Demo"}</Text>
            </PressableScale>
          </View>

          <Button
            mode="contained"
            onPress={() => generateMutation.mutate()}
            loading={generateMutation.isPending}
            disabled={!canGenerate}
            style={{ marginTop: 20 }}
          >
            {generateMutation.isPending ? "Assembling dialogue…" : "Generate conversation"}
          </Button>
          {generateMutation.isError ? (
            <Text variant="bodySmall" style={{ color: t.mode === "dark" ? "#f87171" : "#d32f2f", marginTop: 8, textAlign: "center" }}>
              Could not generate a conversation. Please try again.
            </Text>
          ) : null}
        </AppCard>
      </FadeSlideIn>

      {history.length > 0 ? (
        <FadeSlideIn delay={120} style={styles.section}>
          <SectionHeader title="Recent conversations" action="See all" onAction={() => router.push("/speaking/history")} />
          <View style={{ gap: 12 }}>
            {history.map((c) => (
              <NavCard key={c.id} icon="forum" title={c.topic ?? "Conversation"} onPress={() => router.push(`/speaking/${c.id}`)} />
            ))}
          </View>
        </FadeSlideIn>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  section: { gap: 12 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, alignItems: "center" },
  vocabRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  statePill: { paddingHorizontal: 12, paddingVertical: 6 },
  select: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 50 },
  voiceRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  voiceSelect: { flex: 1 },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
  },
  namesRow: { flexDirection: "row", gap: 12 },
});

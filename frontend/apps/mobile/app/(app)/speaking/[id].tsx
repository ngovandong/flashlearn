import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SpeakingConversation, SpeakingLine } from "@flashlearn/core";
import { speakingApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { GradientSurface } from "@/components/ui/GradientSurface";
import { AnimatedBar } from "@/components/ui/AnimatedBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AudioRecorder, playSpeechClip, speakText } from "@/utils/audio";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

const STAR_GOLD = "#f5a623";

const SCORES: { key: string; label: string; color: string }[] = [
  { key: "accuracyScore", label: "Accuracy", color: "#8b5cf6" },
  { key: "fluencyScore", label: "Fluency", color: "#06b6d4" },
  { key: "completenessScore", label: "Complete", color: "#10b981" },
];

/** Small rounded meta chip (level / tone). */
function MetaChip({ label, t }: { label: string; t: Tokens }) {
  return (
    <View style={[styles.metaChip, { backgroundColor: t.primaryAlpha(0.12), borderRadius: t.radii.pill }]}>
      <Text style={{ color: t.palette.primary, fontWeight: "800", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export default function SpeakingConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [lineIndex, setLineIndex] = useState(0);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [rpRecording, setRpRecording] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const recorder = useRef(new AudioRecorder());
  const audioCache = useRef(new Map<string, { audio_url?: string; audio?: string; mime_type?: string }>());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.speaking.detail(id!),
    queryFn: async () => unwrap<SpeakingConversation>(await speakingApi.getConversation(id!)),
    enabled: !!id,
  });

  const starMutation = useMutation({
    mutationFn: (starred: boolean) => speakingApi.setStar(id!, starred),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.speaking.detail(id!) });
      qc.invalidateQueries({ queryKey: queryKeys.speaking.history });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => speakingApi.deleteConversation(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.speaking.history });
      router.back();
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (payload: { targetText: string; audio: string; mimeType: string }) => {
      const res = await speakingApi.analyze({ ...payload, conversationId: id, kind: "single" });
      return unwrap(res);
    },
    onSuccess: (res) => setAnalysis(res as Record<string, unknown>),
  });

  const lines = data?.lines ?? [];
  const current: SpeakingLine | undefined = lines[lineIndex];
  const meRole = lines[0]?.role;
  const starred = !!(data as { starred?: boolean } | undefined)?.starred;

  const selectLine = (index: number) => {
    setLineIndex(index);
    setAnalysis(null);
    setPlaybackError(null);
  };

  const playLine = async (line: SpeakingLine, key: string) => {
    if (!line.text) return;
    setPlaybackError(null);
    setPlayingKey(key);
    try {
      const voice = line.voice || "Kore";
      const cacheKey = `${voice}:${line.text}`;
      let clip = audioCache.current.get(cacheKey);
      if (!clip) {
        const res = await speakingApi.generateSpeech(line.text, voice);
        clip = unwrap<{ audio_url?: string; audio?: string; mime_type?: string }>(res);
        audioCache.current.set(cacheKey, clip);
      }
      const result = await playSpeechClip(
        { audio_url: clip.audio_url, audio: clip.audio, mime_type: clip.mime_type },
        line.text
      );
      if (!result.ok) setPlaybackError(result.error);
    } finally {
      setPlayingKey(null);
    }
  };

  const startRecording = async () => {
    try {
      await recorder.current.start();
      setRpRecording(true);
    } catch (e) {
      setPlaybackError(e instanceof Error ? e.message : "Could not record.");
    }
  };

  const stopAndAnalyze = async () => {
    const recorded = await recorder.current.stop();
    setRpRecording(false);
    if (!recorded || !current?.text) return;
    analyzeMutation.mutate({
      targetText: current.text,
      audio: recorded.base64,
      mimeType: recorded.mimeType,
    });
  };

  if (isLoading) return <LoadingView />;
  if (isError || !data) return <ErrorView message="Could not load conversation" onRetry={() => refetch()} />;

  const progress = lines.length ? (lineIndex + 1) / lines.length : 0;

  return (
    <ScrollView
      style={{ backgroundColor: t.neutral.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <FadeSlideIn>
        <PressableScale onPress={() => router.back()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={22} color={t.neutral.textMinor} />
          <Text style={{ color: t.neutral.textMinor, fontWeight: "700" }}>Back</Text>
        </PressableScale>

        <AppCard style={{ marginTop: 8 }}>
          <View style={styles.heroRow}>
            <FeatureTile icon="forum" size={46} variant="solid" />
            <View style={{ flex: 1 }}>
              <Text variant="titleLarge" style={{ color: t.neutral.text, fontWeight: "800" }}>
                {data.topic ?? "Conversation"}
              </Text>
              <View style={styles.metaRow}>
                {data.level ? <MetaChip label={data.level} t={t} /> : null}
                {data.tone ? <MetaChip label={data.tone} t={t} /> : null}
                <MetaChip label={`${lines.length} lines`} t={t} />
              </View>
            </View>
          </View>
          <View style={styles.actionRow}>
            <PressableScale
              onPress={() => starMutation.mutate(!starred)}
              hitSlop={8}
              style={[styles.iconBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
            >
              <MaterialIcons
                name={starred ? "star" : "star-outline"}
                size={22}
                color={starred ? STAR_GOLD : t.neutral.textMuted}
              />
            </PressableScale>
            <PressableScale
              onPress={() => deleteMutation.mutate()}
              hitSlop={8}
              style={[styles.iconBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
            >
              <MaterialIcons name="delete-outline" size={22} color={t.neutral.textMuted} />
            </PressableScale>
          </View>
        </AppCard>
      </FadeSlideIn>

      <FadeSlideIn delay={50}>
        <View style={styles.progressHead}>
          <Text variant="labelLarge" style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
            Line {lineIndex + 1} of {lines.length}
          </Text>
          <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "800" }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <AnimatedBar
          progress={progress}
          color={t.palette.primary}
          trackColor={t.neutral.surface2}
          style={{ marginTop: 8 }}
        />
      </FadeSlideIn>

      {playbackError ? (
        <View style={[styles.errorBox, { backgroundColor: t.alpha("#ef4444", 0.12), borderRadius: t.radii.md }]}>
          <MaterialIcons name="error-outline" size={18} color="#ef4444" />
          <Text style={{ color: "#ef4444", flex: 1 }}>{playbackError}</Text>
        </View>
      ) : null}

      <View style={styles.transcript}>
        {lines.map((line, i) => {
          const isMe = line.role === meRole;
          const active = i === lineIndex;
          const key = `${i}`;
          const playing = playingKey === key;
          return (
            <FadeSlideIn key={key} delay={60 + i * 24}>
              <View style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
                <Text
                  variant="labelSmall"
                  style={{
                    color: t.neutral.textMuted,
                    fontWeight: "800",
                    letterSpacing: 0.6,
                    marginBottom: 4,
                    marginHorizontal: 6,
                  }}
                >
                  {(line.role ?? (isMe ? "Me" : "Coach")).toUpperCase()}
                </Text>

                {isMe ? (
                  <PressableScale
                    onPress={() => selectLine(i)}
                    activeScale={0.99}
                    style={[
                      styles.bubbleWrap,
                      { borderRadius: t.radii.lg },
                      active ? t.shadowStrong : null,
                    ]}
                  >
                    <GradientSurface style={[styles.bubble, { borderRadius: t.radii.lg }]}>
                      <Text style={styles.meText}>{line.text}</Text>
                      <View style={styles.bubbleTools}>
                        <PressableScale
                          onPress={() => playLine(line, key)}
                          style={[styles.toolBtn, { backgroundColor: "rgba(255,255,255,0.22)" }]}
                        >
                          {playing ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <MaterialIcons name="volume-up" size={18} color="#ffffff" />
                          )}
                        </PressableScale>
                      </View>
                    </GradientSurface>
                  </PressableScale>
                ) : (
                  <PressableScale
                    onPress={() => selectLine(i)}
                    activeScale={0.99}
                    style={[
                      styles.bubble,
                      styles.bubbleWrap,
                      {
                        backgroundColor: t.neutral.surface,
                        borderRadius: t.radii.lg,
                        borderWidth: 1,
                        borderColor: active ? t.palette.primary : t.neutral.border,
                      },
                      active ? t.shadow : null,
                    ]}
                  >
                    <Text style={{ color: t.neutral.text, fontSize: 15, lineHeight: 22 }}>{line.text}</Text>
                    <View style={styles.bubbleTools}>
                      <PressableScale
                        onPress={() => playLine(line, key)}
                        style={[styles.toolBtn, { backgroundColor: t.primaryAlpha(0.12) }]}
                      >
                        {playing ? (
                          <ActivityIndicator size="small" color={t.palette.primary} />
                        ) : (
                          <MaterialIcons name="volume-up" size={18} color={t.palette.primary} />
                        )}
                      </PressableScale>
                    </View>
                  </PressableScale>
                )}
              </View>
            </FadeSlideIn>
          );
        })}
      </View>

      <FadeSlideIn delay={80}>
        <AppCard style={{ marginTop: 4 }}>
          <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
            Practice this line
          </Text>
          <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 2 }}>
            Record yourself, then get pronunciation feedback.
          </Text>

          <View style={styles.practiceRow}>
            <PressableScale
              onPress={() => current && playLine(current, `current`)}
              style={[styles.listenBtn, { backgroundColor: t.primaryAlpha(0.12), borderRadius: t.radii.pill }]}
            >
              <MaterialIcons name="volume-up" size={18} color={t.palette.primary} />
              <Text style={{ color: t.palette.primary, fontWeight: "800" }}>
                {playingKey === "current" ? "Playing…" : "Listen"}
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => current?.text && speakText(current.text)}
              style={[styles.listenBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
            >
              <MaterialIcons name="graphic-eq" size={18} color={t.neutral.textMinor} />
              <Text style={{ color: t.neutral.textMinor, fontWeight: "700" }}>Fallback</Text>
            </PressableScale>
          </View>

          {rpRecording ? (
            <GradientButton
              label="Stop & analyze"
              icon="stop"
              onPress={stopAndAnalyze}
              loading={analyzeMutation.isPending}
              style={{ marginTop: 12 }}
            />
          ) : (
            <PressableScale
              onPress={startRecording}
              style={[styles.recordBtn, { borderColor: t.palette.primary, borderRadius: t.radii.pill }]}
            >
              <MaterialIcons name="mic" size={20} color={t.palette.primary} />
              <Text style={{ color: t.palette.primary, fontWeight: "800", fontSize: 16 }}>Record</Text>
            </PressableScale>
          )}
          {analyzeMutation.isPending && !rpRecording ? (
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor, textAlign: "center", marginTop: 8 }}>
              Analyzing your pronunciation…
            </Text>
          ) : null}
        </AppCard>
      </FadeSlideIn>

      {analysis ? (
        <FadeSlideIn delay={40}>
          <AppCard>
            <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800", marginBottom: 12 }}>
              Pronunciation
            </Text>
            <View style={styles.scoreRow}>
              {SCORES.filter((s) => analysis[s.key] !== undefined).map((s) => (
                <View key={s.key} style={styles.scoreItem}>
                  <ProgressRing value={Number(analysis[s.key]) || 0} size={84} strokeWidth={8} color={s.color} />
                  <Text variant="labelMedium" style={{ color: t.neutral.textMinor, fontWeight: "700", marginTop: 6 }}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </AppCard>
        </FadeSlideIn>
      ) : null}

      <View style={styles.navRow}>
        <PressableScale
          onPress={() => selectLine(Math.max(lineIndex - 1, 0))}
          disabled={lineIndex <= 0}
          style={[
            styles.navBtn,
            { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill, opacity: lineIndex <= 0 ? 0.4 : 1 },
          ]}
        >
          <MaterialIcons name="chevron-left" size={22} color={t.neutral.text} />
          <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Previous</Text>
        </PressableScale>
        <PressableScale
          onPress={() => selectLine(Math.min(lineIndex + 1, lines.length - 1))}
          disabled={lineIndex >= lines.length - 1}
          style={[
            styles.navBtn,
            {
              backgroundColor: t.neutral.surface2,
              borderRadius: t.radii.pill,
              opacity: lineIndex >= lines.length - 1 ? 0.4 : 1,
            },
          ]}
        >
          <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Next</Text>
          <MaterialIcons name="chevron-right" size={22} color={t.neutral.text} />
        </PressableScale>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 16 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 4 },
  actionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  transcript: { gap: 14 },
  bubbleWrap: { maxWidth: "88%", overflow: "hidden" },
  bubble: { padding: 14 },
  meText: { color: "#ffffff", fontSize: 15, lineHeight: 22, fontWeight: "600" },
  bubbleTools: { flexDirection: "row", gap: 8, marginTop: 10 },
  toolBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  practiceRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  listenBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46 },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderWidth: 2,
    marginTop: 12,
  },
  scoreRow: { flexDirection: "row", justifyContent: "space-around", flexWrap: "wrap", gap: 12 },
  scoreItem: { alignItems: "center" },
  navRow: { flexDirection: "row", gap: 12 },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 48,
  },
});

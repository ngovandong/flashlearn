import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Snackbar, Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SpeakingConversation, SpeakingLine, Highlight, Term } from "@flashlearn/core";
import { speakingApi, termApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { MarkedText, type TextMark } from "@/components/MarkedText";
import VocabModal, { type VocabSelection, type TermMatch } from "@/components/VocabModal";
import { NotePanel } from "@/components/note/NotePanel";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { GradientSurface } from "@/components/ui/GradientSurface";
import { AnimatedBar } from "@/components/ui/AnimatedBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { AudioRecorder, playAudioUrl, playSpeechClip, speakText, stopPlayback } from "@/utils/audio";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

const STAR_GOLD = "#f5a623";

const SCORES: { key: string; label: string; color: string }[] = [
  { key: "accuracyScore", label: "Accuracy", color: "#8b5cf6" },
  { key: "fluencyScore", label: "Fluency", color: "#06b6d4" },
  { key: "rhythmScore", label: "Rhythm", color: "#f59e0b" },
  { key: "completenessScore", label: "Complete", color: "#10b981" },
];

interface WordAnalysis {
  word: string;
  status: "correct" | "incorrect" | "missing" | string;
  accuracyScore?: number;
  ipaTarget?: string;
  ipaSpoken?: string;
  userPronunciation?: string;
  correctPronunciation?: string;
  syllableStress?: string;
  mouthTip?: string;
  feedback?: string;
}

interface KeyStruggle {
  sound?: string;
  description?: string;
  tip?: string;
}

interface AnalysisResult {
  accuracyScore?: number;
  fluencyScore?: number;
  rhythmScore?: number;
  completenessScore?: number;
  wordsPerMinute?: number;
  overallFeedback?: string;
  accentAnalysis?: string;
  keyStruggles?: KeyStruggle[];
  wordAnalysis?: WordAnalysis[];
}

// Speaker name used for the learner's own lines. Not persisted on the
// conversation (matches the web app's assumption when reopening by URL) —
// the generator defaults to "Me" unless the setup screen overrides it.
const USER_SPEAKER = "Me";

const wordStatusColor = (status: string) =>
  status === "correct" ? "#10b981" : status === "incorrect" ? "#ef4444" : "#f59e0b";

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
  const tabBarHeight = useFloatingTabBarHeight();
  const qc = useQueryClient();
  const [lineIndex, setLineIndex] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordAnalysis | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [rpRecording, setRpRecording] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const [playingMine, setPlayingMine] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selected, setSelected] = useState<VocabSelection | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savedWords, setSavedWords] = useState<Record<string, boolean>>({});
  const [snack, setSnack] = useState<string | null>(null);
  const [fullPlaying, setFullPlaying] = useState(false);
  const recorder = useRef(new AudioRecorder());
  const audioCache = useRef(new Map<string, { audio_url?: string; audio?: string; mime_type?: string }>());
  const cancelFullRef = useRef(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.speaking.detail(id!),
    queryFn: async () => unwrap<SpeakingConversation>(await speakingApi.getConversation(id!)),
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.highlights) setHighlights(data.highlights);
  }, [data?.highlights]);

  const matchTermsQuery = useQuery({
    queryKey: ["speaking", "matchTerms", id],
    queryFn: async () => unwrap<{ matches: TermMatch[] }>(await speakingApi.matchTerms(id!)),
    enabled: !!id,
  });
  const termMatches = matchTermsQuery.data?.matches ?? [];

  // Stop any in-flight playback/recording when leaving the screen so the mic
  // never stays "hot" and a stray recorder instance doesn't leak.
  useEffect(
    () => () => {
      cancelFullRef.current = true;
      stopPlayback();
      if (recorder.current.isRecording) recorder.current.cancel().catch(() => {});
    },
    []
  );

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
      const data = unwrap<{ result?: AnalysisResult }>(res);
      return data.result ?? {};
    },
    onSuccess: (res) => {
      setAnalysis(res);
      const firstIssue = (res.wordAnalysis ?? []).find((w) => w.status !== "correct");
      setSelectedWord(firstIssue ?? res.wordAnalysis?.[0] ?? null);
    },
  });

  const highlightMutation = useMutation({
    mutationFn: (payload: { text: string; note?: string; remove?: boolean }) =>
      speakingApi.setHighlight(id!, payload),
    onSuccess: (res) => setHighlights(unwrap<{ highlights: Highlight[] }>(res).highlights ?? []),
    onError: () => setSnack("Could not update highlight."),
  });

  const saveTermMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const payload: Term = {
        name: selected.text,
        meaning: selected.fields?.find((f) => f.label === "Meaning")?.value ?? "",
        ai_filled: false,
      };
      return unwrap(await termApi.addToDefaultDeck(payload));
    },
    onSuccess: () => {
      setSnack(`"${selected?.text}" saved to your default deck.`);
      setSelected(null);
      matchTermsQuery.refetch();
    },
    onError: () => setSnack("Could not save term."),
  });

  const saveWordMutation = useMutation({
    mutationFn: async (word: WordAnalysis) =>
      unwrap(
        await termApi.addToDefaultDeck({
          name: word.word,
          meaning: word.feedback || "",
          pronunciation: word.ipaTarget || "",
          ai_filled: false,
        })
      ),
    onSuccess: (_res, word) => {
      setSavedWords((prev) => ({ ...prev, [word.word]: true }));
      setSnack(`"${word.word}" saved to your default deck.`);
    },
    onError: () => setSnack("Could not save term."),
  });

  const lines = data?.lines ?? [];
  const current: SpeakingLine | undefined = lines[lineIndex];
  const starred = !!(data as { starred?: boolean } | undefined)?.starred;

  const isHighlighted = (text: string) =>
    highlights.some((h) => (h.text || "").toLowerCase() === (text || "").toLowerCase());
  const findTermMatch = (text: string) =>
    termMatches.find((m) => (m.name || "").toLowerCase() === (text || "").toLowerCase()) || null;

  const openVocab = async (rawText: string, context?: string) => {
    const text = (rawText || "").trim();
    if (!text || text.length < 2 || text.length > 80) return;
    const existing = highlights.find((h) => (h.text || "").toLowerCase() === text.toLowerCase());
    setNoteDraft(existing?.note || "");
    setSelected({ text, context, loading: true });
    try {
      const explain = unwrap<{ meaning?: string; ipaExplanation?: string; mouthTip?: string }>(
        await speakingApi.explainPhrase(text, context || "")
      );
      setSelected((prev) =>
        prev && prev.text === text
          ? {
              ...prev,
              loading: false,
              fields: [
                { label: "Meaning", value: explain.meaning || "" },
                { label: "Pronunciation", value: explain.ipaExplanation || "" },
                { label: "Speaking tip", value: explain.mouthTip || "" },
              ],
            }
          : prev
      );
    } catch {
      setSelected((prev) =>
        prev && prev.text === text ? { ...prev, loading: false, error: "Failed to load. Tap retry." } : prev
      );
    }
  };

  const lineMarks = (text: string): TextMark[] => [
    ...highlights.map((h) => ({ text: h.text, color: t.neutral.text, tint: t.primaryAlpha(0.16) })),
    ...termMatches.map((m) => ({ text: m.name || "", color: t.palette.primary, tint: t.primaryAlpha(0.1) })),
  ];

  const selectLine = (index: number) => {
    setLineIndex(index);
    setAnalysis(null);
    setSelectedWord(null);
    setPlaybackError(null);
    setLastRecordingUri(null);
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

  // Plays every line back-to-back, e.g. so the learner can hear the full
  // conversation before practicing individual lines.
  const playFull = async () => {
    if (!lines.length || fullPlaying) return;
    cancelFullRef.current = false;
    setFullPlaying(true);
    for (let i = 0; i < lines.length; i++) {
      if (cancelFullRef.current) break;
      setLineIndex(i);
      await playLine(lines[i], `full-${i}`);
    }
    cancelFullRef.current = false;
    setFullPlaying(false);
  };

  const stopFullPlaying = () => {
    cancelFullRef.current = true;
    stopPlayback();
    setFullPlaying(false);
    setPlayingKey(null);
  };

  const playMyRecording = async () => {
    if (!lastRecordingUri) return;
    setPlayingMine(true);
    try {
      await playAudioUrl(lastRecordingUri);
    } finally {
      setPlayingMine(false);
    }
  };

  const startRecording = async () => {
    try {
      await recorder.current.start();
      setRpRecording(true);
      setPlaybackError(null);
    } catch (e) {
      setPlaybackError(e instanceof Error ? e.message : "Microphone access denied or unavailable.");
    }
  };

  const stopAndAnalyze = async () => {
    try {
      const recorded = await recorder.current.stop();
      if (!recorded || !current?.text) {
        if (!recorded) setPlaybackError("The microphone didn't capture any sound. Please try again.");
        return;
      }
      setLastRecordingUri(recorded.uri);
      analyzeMutation.mutate({
        targetText: current.text,
        audio: recorded.base64,
        mimeType: recorded.mimeType,
      });
    } catch (e) {
      setPlaybackError(e instanceof Error ? e.message : "Could not save that recording.");
    } finally {
      setRpRecording(false);
    }
  };

  if (isLoading) return <LoadingView />;
  if (isError || !data) return <ErrorView message="Could not load conversation" onRetry={() => refetch()} />;

  const progress = lines.length ? (lineIndex + 1) / lines.length : 0;
  const wordAnalysis = analysis?.wordAnalysis ?? [];

  return (
    <ScrollView
      style={{ backgroundColor: t.neutral.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: tabBarHeight }]}
      showsVerticalScrollIndicator={false}
    >
      <FadeSlideIn>
        <PressableScale onPress={() => router.back()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={22} color={t.neutral.textMinor} />
          <Text style={{ color: t.neutral.textMinor, fontWeight: "700" }}>Back</Text>
        </PressableScale>

        <AppCard style={{ marginTop: 8 }}>
          <View style={styles.heroRow}>
            <FeatureTile icon="record-voice-over" size={46} variant="solid" />
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
              onPress={fullPlaying ? stopFullPlaying : playFull}
              style={[
                styles.playFullBtn,
                { backgroundColor: t.primaryAlpha(0.12), borderRadius: t.radii.pill },
              ]}
            >
              <MaterialIcons
                name={fullPlaying ? "stop" : "play-arrow"}
                size={18}
                color={t.palette.primary}
              />
              <Text style={{ color: t.palette.primary, fontWeight: "800" }}>
                {fullPlaying ? "Stop" : "Play conversation"}
              </Text>
            </PressableScale>
            <View style={{ flex: 1 }} />
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

      <View style={[styles.tip, { backgroundColor: t.primaryAlpha(0.08), borderRadius: t.radii.md }]}>
        <MaterialIcons name="info-outline" size={16} color={t.palette.primary} />
        <Text variant="bodySmall" style={{ color: t.neutral.textMinor, flex: 1 }}>
          Tap any word for its meaning, IPA and a speaking tip. Saved words and highlights are tinted.
        </Text>
      </View>

      {playbackError ? (
        <View style={[styles.errorBox, { backgroundColor: t.alpha("#ef4444", 0.12), borderRadius: t.radii.md }]}>
          <MaterialIcons name="error-outline" size={18} color="#ef4444" />
          <Text style={{ color: "#ef4444", flex: 1 }}>{playbackError}</Text>
        </View>
      ) : null}

      <View style={styles.transcript}>
        {lines.map((line, i) => {
          const isMe = line.speaker === USER_SPEAKER;
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
                  {(line.speaker || (isMe ? "Me" : "Coach")).toUpperCase()}
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
                      <MarkedText
                        text={line.text || ""}
                        marks={lineMarks(line.text || "")}
                        onWordPress={(w) => openVocab(w, line.text)}
                        style={styles.meText}
                      />
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
                    <MarkedText
                      text={line.text || ""}
                      marks={lineMarks(line.text || "")}
                      onWordPress={(w) => openVocab(w, line.text)}
                      style={{ color: t.neutral.text, fontSize: 15, lineHeight: 22 }}
                    />
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
          {analyzeMutation.isError ? (
            <View style={styles.analyzeError}>
              <Text variant="bodySmall" style={{ color: "#ef4444", textAlign: "center" }}>
                Pronunciation analysis failed.
              </Text>
              <PressableScale
                onPress={stopAndAnalyze}
                style={[styles.retryBtn, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}
              >
                <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Retry</Text>
              </PressableScale>
            </View>
          ) : null}
        </AppCard>
      </FadeSlideIn>

      {analysis ? (
        <FadeSlideIn delay={40}>
          <AppCard>
            <View style={styles.analysisHead}>
              <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
                Pronunciation diagnostics
              </Text>
              {lastRecordingUri ? (
                <PressableScale
                  onPress={playMyRecording}
                  style={[styles.pillBtnSm, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
                >
                  <MaterialIcons name={playingMine ? "pause" : "mic"} size={14} color={t.neutral.text} />
                  <Text style={{ color: t.neutral.text, fontWeight: "700", fontSize: 12 }}>
                    {playingMine ? "Playing…" : "My recording"}
                  </Text>
                </PressableScale>
              ) : null}
            </View>

            <View style={styles.scoreRow}>
              {SCORES.filter((s) => analysis[s.key as keyof AnalysisResult] !== undefined).map((s) => (
                <View key={s.key} style={styles.scoreItem}>
                  <ProgressRing
                    value={Number(analysis[s.key as keyof AnalysisResult]) || 0}
                    size={76}
                    strokeWidth={7}
                    color={s.color}
                  />
                  <Text variant="labelMedium" style={{ color: t.neutral.textMinor, fontWeight: "700", marginTop: 6 }}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            {analysis.wordsPerMinute ? (
              <View style={[styles.wpmRow, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}>
                <MaterialIcons name="speed" size={16} color={t.neutral.textMinor} />
                <Text style={{ color: t.neutral.text, fontWeight: "700" }}>
                  {analysis.wordsPerMinute} WPM
                </Text>
              </View>
            ) : null}

            {analysis.accentAnalysis ? (
              <View style={[styles.calloutWarn, { backgroundColor: t.alpha("#f59e0b", 0.12), borderRadius: t.radii.md }]}>
                <MaterialIcons name="warning-amber" size={16} color="#f59e0b" />
                <Text style={{ color: t.neutral.text, flex: 1 }}>{analysis.accentAnalysis}</Text>
              </View>
            ) : null}

            {(analysis.keyStruggles ?? []).length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>
                  KEY VOCAL CHALLENGES
                </Text>
                {(analysis.keyStruggles ?? []).map((s, i) => (
                  <View key={i} style={[styles.struggle, { borderColor: t.neutral.border }]}>
                    <Text style={{ color: t.neutral.text, fontWeight: "800" }}>{s.sound}</Text>
                    <Text style={{ color: t.neutral.textMinor, marginTop: 2 }}>{s.description}</Text>
                    {s.tip ? (
                      <Text style={{ color: t.neutral.textMinor, marginTop: 4, fontStyle: "italic" }}>
                        Tip: {s.tip}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {wordAnalysis.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>
                  INTERACTIVE SENTENCE MAP
                </Text>
                <View style={styles.wordWrap}>
                  {wordAnalysis.map((w, i) => {
                    const color = wordStatusColor(w.status);
                    const isActive = selectedWord?.word === w.word;
                    return (
                      <PressableScale
                        key={i}
                        onPress={() => setSelectedWord(w)}
                        style={[
                          styles.wordChip,
                          {
                            backgroundColor: t.alpha(color, isActive ? 0.28 : 0.14),
                            borderColor: color,
                            borderRadius: t.radii.pill,
                          },
                        ]}
                      >
                        <Text style={{ color, fontWeight: "700" }}>{w.word}</Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {selectedWord ? (
              <View style={[styles.wordDetail, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}>
                <View style={styles.wordDetailHead}>
                  <Text variant="titleSmall" style={{ color: t.neutral.text, fontWeight: "800" }}>
                    "{selectedWord.word}"
                  </Text>
                  <PressableScale onPress={() => speakText(selectedWord.word)} hitSlop={8}>
                    <MaterialIcons name="volume-up" size={18} color={t.palette.primary} />
                  </PressableScale>
                  <View style={{ flex: 1 }} />
                  <PressableScale
                    onPress={() => saveWordMutation.mutate(selectedWord)}
                    disabled={!!savedWords[selectedWord.word] || saveWordMutation.isPending}
                    style={[styles.pillBtnSm, { backgroundColor: t.palette.primary, borderRadius: t.radii.pill }]}
                  >
                    <MaterialIcons name="add" size={14} color={t.palette.onPrimary} />
                    <Text style={{ color: t.palette.onPrimary, fontWeight: "700", fontSize: 12 }}>
                      {savedWords[selectedWord.word] ? "Saved" : "Save"}
                    </Text>
                  </PressableScale>
                </View>
                <View style={styles.wordDetailGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 11 }}>TARGET IPA</Text>
                    <Text style={{ color: "#10b981", fontWeight: "700" }}>{selectedWord.ipaTarget || "/--/"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 11 }}>DETECTED IPA</Text>
                    <Text style={{ color: "#ef4444", fontWeight: "700" }}>
                      {selectedWord.ipaSpoken || selectedWord.userPronunciation || "/--/"}
                    </Text>
                  </View>
                </View>
                {selectedWord.syllableStress ? (
                  <Text style={{ color: t.neutral.textMinor, marginTop: 8 }}>
                    Stress: {selectedWord.syllableStress}
                  </Text>
                ) : null}
                {selectedWord.mouthTip ? (
                  <Text style={{ color: t.neutral.textMinor, marginTop: 8, fontStyle: "italic" }}>
                    {selectedWord.mouthTip}
                  </Text>
                ) : null}
                {selectedWord.feedback ? (
                  <Text style={{ color: t.neutral.text, marginTop: 8 }}>"{selectedWord.feedback}"</Text>
                ) : null}
              </View>
            ) : null}
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

      <VocabModal
        selected={selected}
        highlighted={selected ? isHighlighted(selected.text) : false}
        noteDraft={noteDraft}
        onNoteChange={setNoteDraft}
        showHighlightControls
        termMatch={selected ? findTermMatch(selected.text) : null}
        onClose={() => setSelected(null)}
        onRetry={() => selected && openVocab(selected.text, selected.context)}
        onListen={(text) => speakText(text)}
        onToggleHighlight={(remove) =>
          selected && highlightMutation.mutate({ text: selected.text, note: noteDraft, remove })
        }
        onSaveTerm={() => saveTermMutation.mutate()}
        saving={saveTermMutation.isPending}
        onRemoveTerm={async (m) => {
          if (!m.term_id) return;
          try {
            await termApi.delete(m.term_id);
            matchTermsQuery.refetch();
            setSnack(`"${m.name}" removed from your deck.`);
          } catch {
            setSnack("Could not remove the term.");
          }
        }}
      />

      <NotePanel
        targetType="speaking_session"
        targetKey={id}
        title={data?.topic}
        targetUrl={`/speaking/${id}`}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 16 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 4 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  playFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tip: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
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
  analyzeError: { alignItems: "center", marginTop: 10, gap: 6 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5 },
  analysisHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  pillBtnSm: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  scoreRow: { flexDirection: "row", justifyContent: "space-around", flexWrap: "wrap", gap: 12 },
  scoreItem: { alignItems: "center" },
  wpmRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, marginTop: 14 },
  calloutWarn: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, marginTop: 12 },
  struggle: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8 },
  wordWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  wordChip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5 },
  wordDetail: { padding: 14, marginTop: 14 },
  wordDetailHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordDetailGrid: { flexDirection: "row", gap: 16, marginTop: 10 },
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

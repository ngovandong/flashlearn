import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ActivityIndicator, Button, Snackbar, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { courseApi, speakingApi, termApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { NotePanel } from "@/components/note/NotePanel";
import { AppCard } from "@/components/ui/AppCard";
import { PressableScale } from "@/components/PressableScale";
import { useTokens } from "@/theme/tokens";
import {
  AudioRecorder,
  playSpeechClip,
  speakText,
  stopPlayback,
  type PlaybackResult,
} from "@/utils/audio";
import { unwrap } from "@/utils/apiError";
import { MarkedText, type TextMark } from "@/components/MarkedText";
import VocabModal, { type VocabSelection, type TermMatch } from "@/components/VocabModal";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";

interface LessonHighlight {
  text: string;
  note?: string;
}

// ── Types ─────────────────────────────────────────────────────────────────
interface LessonLine {
  speaker?: string;
  text?: string;
  voice?: string;
  align?: "left" | "right";
}

interface LessonCharacter {
  name?: string;
  images?: Record<string, string>;
}

interface AudioClipLine {
  voice?: string;
  text?: string;
  audio_url?: string;
  audio?: string;
  mime_type?: string;
}

interface RolePlaySession {
  id: number;
  text: string;
  result: {
    accuracyScore?: number;
    fluencyScore?: number;
    completenessScore?: number;
  };
}

interface DictationSavedLine {
  target?: string;
  typed?: string;
  correct?: number;
  total?: number;
}

interface LessonExerciseBlank {
  answer?: string;
}

interface LessonExerciseQuestion {
  text?: string;
  answers?: string[];
}

interface LessonExercise {
  kind?: "fill_blank" | "choice" | string;
  prompt?: string;
  sentence?: string;
  blanks?: LessonExerciseBlank[];
  questions?: LessonExerciseQuestion[];
}

interface CourseLesson {
  id: string;
  /** Stable natural key — what per-user data (progress, notes) is filed under. */
  key?: string;
  title?: string;
  description?: string;
  lines?: LessonLine[];
  characters?: LessonCharacter[];
  has_audio?: boolean;
  background?: string;
  exercises?: LessonExercise[];
  progress?: {
    best_score?: number;
    status?: string;
    last_result?: { score?: number; passed?: boolean; sessions?: RolePlaySession[] };
    last_dictation?: { score?: number; lines?: DictationSavedLine[]; at?: string };
    highlights?: LessonHighlight[];
  };
}

const PASS_THRESHOLD = 80;
const DICTATION_GOOD = 80;

// Character art is mirrored to our Cloudinary at crawl time; older lessons fall
// back to freeCodeCamp's CDN (mirrors the web CoursePanel behaviour).
const FCC_IMG_BASE =
  "https://cdn.freecodecamp.org/curriculum/english/animation-assets/images";
const FIGURE_LAYERS = ["base", "brows-normal", "eyes-open", "mouth-smile", "glasses"];

function characterFolder(name?: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function backgroundUrl(background?: string): string | null {
  if (!background) return null;
  if (/^https?:\/\//.test(background)) return background;
  return `${FCC_IMG_BASE}/backgrounds/${background}`;
}

function avatarColor(name?: string): string {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash * 31 + name!.charCodeAt(i)) % 360;
  return `hsl(${hash}, 55%, 52%)`;
}

function initials(name?: string): string {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

function clipKey(voice?: string, text?: string): string {
  return `${voice || ""}|${text || ""}`;
}

// ── Word-level dictation diff (port of the web dictationDiff) ───────────────
type DiffToken = { word: string; status: "ok" | "missing" | "wrong" };
interface LineDiff {
  target: string;
  typed: string;
  targetTokens: DiffToken[];
  typedTokens: DiffToken[];
  correct: number;
  total: number;
}

function tokenize(text: string): string[] {
  return (text || "").trim().split(/\s+/).filter(Boolean);
}

function normWord(word: string): string {
  return (word || "").toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function diffLine(target: string, typed: string): Omit<LineDiff, "target" | "typed"> {
  const tWords = tokenize(target);
  const uWords = tokenize(typed);
  const tn = tWords.map(normWord);
  const un = uWords.map(normWord);
  const n = tn.length;
  const m = un.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = tn[i] === un[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const targetTokens: DiffToken[] = [];
  const typedTokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (tn[i] === un[j]) {
      targetTokens.push({ word: tWords[i], status: "ok" });
      typedTokens.push({ word: uWords[j], status: "ok" });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      targetTokens.push({ word: tWords[i], status: "missing" });
      i += 1;
    } else {
      typedTokens.push({ word: uWords[j], status: "wrong" });
      j += 1;
    }
  }
  while (i < n) targetTokens.push({ word: tWords[i++], status: "missing" });
  while (j < m) typedTokens.push({ word: uWords[j++], status: "wrong" });
  return { targetTokens, typedTokens, correct: dp[0][0], total: n };
}

function evaluateDictation(lines: LessonLine[], inputs: string[]) {
  const perLine: LineDiff[] = (lines || []).map((line, index) => {
    const target = line?.text || "";
    const typed = inputs?.[index] || "";
    return { target, typed, ...diffLine(target, typed) };
  });
  const totalWords = perLine.reduce((s, l) => s + l.total, 0);
  const correctWords = perLine.reduce((s, l) => s + l.correct, 0);
  const score = totalWords ? Math.round((correctWords / totalWords) * 100) : 0;
  return { score, lines: perLine };
}

function hydrateDictation(saved?: { score?: number; lines?: DictationSavedLine[] }) {
  if (!saved?.lines?.length) return null;
  const lines: LineDiff[] = saved.lines.map((l) => ({
    target: l.target || "",
    typed: l.typed || "",
    ...diffLine(l.target || "", l.typed || ""),
  }));
  return { score: saved.score || 0, lines };
}

// ── Illustrated character (stacked layers, or an initial avatar fallback) ───
function StageFigure({
  name,
  images,
  active,
  dim,
  primary,
}: {
  name?: string;
  images?: Record<string, string>;
  active: boolean;
  dim: boolean;
  primary: string;
}) {
  const [failed, setFailed] = useState(false);
  const stored = images && Object.keys(images).length > 0;
  const layers = stored
    ? FIGURE_LAYERS.filter((layer) => images![layer]).map((layer) => ({ layer, src: images![layer] }))
    : FIGURE_LAYERS.map((layer) => ({
        layer,
        src: `${FCC_IMG_BASE}/characters/${characterFolder(name)}/${layer}.png`,
      }));
  const hasArt = layers.some((l) => l.layer === "base") && !failed;

  return (
    <View style={[styles.figure, { opacity: dim ? 0.4 : 1 }]}>
      <View style={styles.figureArt}>
        {hasArt ? (
          layers.map(({ layer, src }) => (
            <Image
              key={layer}
              source={{ uri: src }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              onError={layer === "base" ? () => setFailed(true) : undefined}
            />
          ))
        ) : (
          <View style={[styles.figureFallback, { backgroundColor: avatarColor(name) }]}>
            <Text style={styles.figureFallbackText}>{initials(name)}</Text>
          </View>
        )}
      </View>
      <View style={[styles.figureName, active && { backgroundColor: primary }]}>
        <Text numberOfLines={1} style={styles.figureNameText}>
          {name}
        </Text>
      </View>
    </View>
  );
}

// ── Animated "now playing" equalizer shown on the currently-spoken line ─────
function PlayingIndicator({ color }: { color: string }) {
  const bars = useRef([
    new Animated.Value(0.4),
    new Animated.Value(0.9),
    new Animated.Value(0.55),
  ]).current;

  useEffect(() => {
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: 320 + i * 110,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 320 + i * 110,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars]);

  return (
    <View style={styles.eq}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.eqBar, { backgroundColor: color, transform: [{ scaleY: v }] }]}
        />
      ))}
    </View>
  );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CourseLessonScreen() {
  const { courseSlug, lessonId } = useLocalSearchParams<{ courseSlug: string; lessonId: string }>();
  const t = useTokens();
  const tabBarHeight = useFloatingTabBarHeight();

  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playingLine, setPlayingLine] = useState<string | null>(null);

  // Scene playback
  const [scenePlaying, setScenePlaying] = useState(false);
  const [sceneIndex, setSceneIndex] = useState<number | null>(null);
  const sceneRef = useRef(false);

  // Role-play
  const [rpActive, setRpActive] = useState(false);
  const [rpCharacter, setRpCharacter] = useState<string | null>(null);
  const [rpIndex, setRpIndex] = useState<number | null>(null);
  const [rpRecording, setRpRecording] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; threshold: number } | null>(null);
  const [sessions, setSessions] = useState<RolePlaySession[]>([]);
  const rpRef = useRef(false);
  const rpIndexRef = useRef<number | null>(null);
  const rpCharacterRef = useRef<string | null>(null);
  const turnsRef = useRef<{ target_text: string; audio: string; mime_type: string }[]>([]);
  const recorder = useRef(new AudioRecorder());

  // Per-line pronunciation practice (record + evaluate a single sentence)
  const [lineRecordingIndex, setLineRecordingIndex] = useState<number | null>(null);
  const [lineResults, setLineResults] = useState<
    Record<number, { accuracyScore?: number; fluencyScore?: number; overallFeedback?: string }>
  >({});
  const lineRecorder = useRef(new AudioRecorder());

  // Listen & type (dictation)
  const [dictationOn, setDictationOn] = useState(false);
  const [dictationInputs, setDictationInputs] = useState<string[]>([]);
  const [dictationResult, setDictationResult] = useState<{ score: number; lines: LineDiff[] } | null>(null);
  const [dictationPlaying, setDictationPlaying] = useState(false);
  const [dictationIndex, setDictationIndex] = useState<number | null>(null);
  const [dictationLoop, setDictationLoop] = useState(false);
  const dictRef = useRef(false);
  const dictLoopRef = useRef(false);
  const dictInputsRef = useRef<string[]>([]);

  // Study notes & exercises (read-only)
  const [showExercises, setShowExercises] = useState(false);

  // Vocabulary lookup (tap-to-explain, highlight, save-to-deck)
  const [highlights, setHighlights] = useState<LessonHighlight[]>([]);
  const [selected, setSelected] = useState<VocabSelection | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [vocabSnack, setVocabSnack] = useState<string | null>(null);

  const courseQuery = useQuery({
    queryKey: ["course", courseSlug],
    queryFn: async () => unwrap<{ sections?: { lessons?: CourseLesson[] }[] }>(await courseApi.getCourse(courseSlug!)),
    enabled: !!courseSlug,
  });

  const audioQuery = useQuery({
    queryKey: ["course", "lesson-audio", lessonId],
    queryFn: async () => unwrap<{ lines: AudioClipLine[] }>(await courseApi.getLessonAudio(lessonId!)),
    enabled: !!lessonId,
  });

  const lesson: CourseLesson | undefined = useMemo(() => {
    for (const section of courseQuery.data?.sections ?? []) {
      const found = (section.lessons ?? []).find((l) => String(l.id) === String(lessonId));
      if (found) return found;
    }
    return undefined;
  }, [courseQuery.data, lessonId]);

  const audioMap = useMemo(() => {
    const map = new Map<string, AudioClipLine>();
    for (const line of audioQuery.data?.lines ?? []) map.set(clipKey(line.voice, line.text), line);
    return map;
  }, [audioQuery.data]);

  const lines = useMemo(() => lesson?.lines ?? [], [lesson]);
  const characters = lesson?.characters ?? [];
  const passed = lesson?.progress?.status === "passed";
  const hasAudio = !!lesson?.has_audio;

  const matchTermsQuery = useQuery({
    queryKey: ["course", "matchTerms", lessonId, lines.length],
    queryFn: async () =>
      unwrap<{ matches: TermMatch[] }>(
        await speakingApi.matchTerms({ texts: lines.map((l) => l.text || "").filter(Boolean) })
      ),
    enabled: !!lessonId && lines.length > 0,
  });
  const termMatches = matchTermsQuery.data?.matches ?? [];

  // Restore the last saved role-play / dictation so a revisit shows prior work.
  useEffect(() => {
    if (!lesson) return;
    const saved = lesson.progress?.last_result;
    if (saved?.sessions?.length) {
      setSessions(saved.sessions);
      setResult({ score: saved.score ?? 0, passed: !!saved.passed, threshold: PASS_THRESHOLD });
    } else {
      setSessions([]);
      setResult(null);
    }
    const empty = (lesson.lines ?? []).map(() => "");
    dictInputsRef.current = empty;
    setDictationInputs(empty);
    setDictationResult(null);
    setDictationOn(false);
    setHighlights(lesson.progress?.highlights ?? []);
    setLineResults({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  const isHighlighted = (text: string) =>
    highlights.some((h) => (h.text || "").toLowerCase() === (text || "").toLowerCase());
  const findTermMatch = (text: string) =>
    termMatches.find((m) => (m.name || "").toLowerCase() === (text || "").toLowerCase()) || null;

  const highlightMutation = useMutation({
    mutationFn: (payload: { text: string; note?: string; remove?: boolean }) =>
      courseApi.setHighlight(lessonId!, payload),
    onSuccess: (res) => setHighlights(unwrap<{ highlights: LessonHighlight[] }>(res).highlights ?? []),
    onError: () => setVocabSnack("Could not update highlight."),
  });

  const saveTermMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      return unwrap(
        await termApi.addToDefaultDeck({
          name: selected.text,
          meaning: selected.fields?.find((f) => f.label === "Meaning")?.value ?? "",
          pronunciation: selected.fields?.find((f) => f.label === "Pronunciation")?.value ?? "",
          ai_filled: false,
        })
      );
    },
    onSuccess: () => {
      setVocabSnack(`"${selected?.text}" saved to your default deck.`);
      setSelected(null);
      matchTermsQuery.refetch();
    },
    onError: () => setVocabSnack("Could not save term."),
  });

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

  const lineMarks = (): TextMark[] => [
    ...highlights.map((h) => ({ text: h.text, color: t.neutral.text, tint: t.primaryAlpha(0.16) })),
    ...termMatches.map((m) => ({ text: m.name || "", color: t.palette.primary, tint: t.primaryAlpha(0.1) })),
  ];

  // Tear playback down on unmount.
  useEffect(
    () => () => {
      sceneRef.current = false;
      rpRef.current = false;
      dictRef.current = false;
      stopPlayback();
      if (lineRecorder.current.isRecording) lineRecorder.current.cancel().catch(() => {});
    },
    []
  );

  const playLine = useCallback(
    async (line: LessonLine): Promise<PlaybackResult> => {
      setPlaybackError(null);
      setPlayingLine(line.text ?? null);
      const clip = audioMap.get(clipKey(line.voice, line.text));
      let res: PlaybackResult;
      if (clip) {
        res = await playSpeechClip(
          { audio_url: clip.audio_url, audio: clip.audio, mime_type: clip.mime_type },
          line.text
        );
      } else if (line.text) {
        await speakText(line.text);
        res = { ok: true };
      } else {
        res = { ok: false, error: "Nothing to play." };
      }
      if (!res.ok) setPlaybackError(res.error);
      setPlayingLine((cur) => (cur === line.text ? null : cur));
      return res;
    },
    [audioMap]
  );

  // ── Scene ─────────────────────────────────────────────────────────────
  const stopScene = useCallback(() => {
    sceneRef.current = false;
    setScenePlaying(false);
    setSceneIndex(null);
    stopPlayback();
  }, []);

  const playScene = async () => {
    if (scenePlaying) {
      stopScene();
      return;
    }
    if (!lines.length) return;
    setResult(null);
    sceneRef.current = true;
    setScenePlaying(true);
    for (let i = 0; i < lines.length; i++) {
      if (!sceneRef.current) return;
      setSceneIndex(i);
      await playLine(lines[i]);
      if (!sceneRef.current) return;
    }
    stopScene();
  };

  // ── Role-play ───────────────────────────────────────────────────────────
  const rolePlayMutation = useMutation({
    mutationFn: async (segments: { target_text: string; audio: string; mime_type: string }[]) => {
      const res = await courseApi.submitRolePlay({ lessonId: lessonId!, segments });
      return unwrap<{ score: number; passed: boolean; threshold: number; sessions?: RolePlaySession[] }>(res);
    },
    onSuccess: (data) => {
      setResult({ score: data.score, passed: data.passed, threshold: data.threshold });
      setSessions(data.sessions ?? []);
      courseQuery.refetch();
    },
    onError: () => setPlaybackError("Could not score your role-play."),
  });

  const runRolePlayFrom = async (start: number, character: string) => {
    for (let i = start; i < lines.length; i++) {
      if (!rpRef.current) return;
      rpIndexRef.current = i;
      setRpIndex(i);
      const line = lines[i];
      if (line.speaker === character) return; // learner's turn — wait for a recording
      await playLine(line);
      if (!rpRef.current) return;
    }
    finishRolePlay();
  };

  const beginRolePlay = (character: string) => {
    if (!lines.length) return;
    setResult(null);
    setSessions([]);
    setRpCharacter(character);
    rpCharacterRef.current = character;
    setRpActive(true);
    rpRef.current = true;
    turnsRef.current = [];
    runRolePlayFrom(0, character);
  };

  const finishRolePlay = () => {
    rpRef.current = false;
    setRpActive(false);
    setRpIndex(null);
    rpIndexRef.current = null;
    if (turnsRef.current.length) rolePlayMutation.mutate(turnsRef.current);
  };

  const cancelRolePlay = async () => {
    rpRef.current = false;
    stopPlayback();
    if (recorder.current.isRecording) await recorder.current.cancel();
    setRpActive(false);
    setRpIndex(null);
    setRpRecording(false);
    rpIndexRef.current = null;
  };

  const startRecording = async () => {
    try {
      await recorder.current.start();
      setRpRecording(true);
    } catch (e) {
      setPlaybackError(e instanceof Error ? e.message : "Could not start recording.");
    }
  };

  const stopRecording = async () => {
    const recorded = await recorder.current.stop();
    setRpRecording(false);
    const idx = rpIndexRef.current;
    if (idx == null) return;
    const line = lines[idx];
    if (recorded && line?.text) {
      turnsRef.current.push({ target_text: line.text, audio: recorded.base64, mime_type: recorded.mimeType });
    }
    runRolePlayFrom(idx + 1, rpCharacterRef.current || rpCharacter || "");
  };

  // ── Per-line pronunciation practice ────────────────────────────────────
  const analyzeLineMutation = useMutation({
    mutationFn: async (payload: { index: number; targetText: string; audio: string; mimeType: string }) => {
      const res = await speakingApi.analyze({
        targetText: payload.targetText,
        audio: payload.audio,
        mimeType: payload.mimeType,
        kind: "single",
      });
      const data = unwrap<{ result?: { accuracyScore?: number; fluencyScore?: number; overallFeedback?: string } }>(
        res
      );
      return { index: payload.index, result: data.result ?? {} };
    },
    onSuccess: ({ index, result }) => setLineResults((prev) => ({ ...prev, [index]: result })),
    onError: () => setPlaybackError("Could not score that line."),
  });

  const startLineRecording = async (index: number) => {
    try {
      await lineRecorder.current.start();
      setLineRecordingIndex(index);
    } catch (e) {
      setPlaybackError(e instanceof Error ? e.message : "Could not start recording.");
    }
  };

  const stopLineRecording = async (index: number, text: string) => {
    const recorded = await lineRecorder.current.stop();
    setLineRecordingIndex(null);
    if (!recorded || !text) return;
    analyzeLineMutation.mutate({
      index,
      targetText: text,
      audio: recorded.base64,
      mimeType: recorded.mimeType,
    });
  };

  // ── Listen & type ─────────────────────────────────────────────────────
  const dictationFilled = dictationInputs.filter((s) => (s || "").trim()).length;
  const allDictationFilled = () =>
    !!lines.length && dictInputsRef.current.filter((s) => (s || "").trim()).length >= lines.length;

  const stopDictation = useCallback(() => {
    dictRef.current = false;
    setDictationPlaying(false);
    setDictationIndex(null);
    stopPlayback();
  }, []);

  const enterDictation = () => {
    stopScene();
    setResult(null);
    const saved = hydrateDictation(lesson?.progress?.last_dictation);
    if (saved) {
      const typed = saved.lines.map((l) => l.typed || "");
      dictInputsRef.current = typed;
      setDictationInputs(typed);
      setDictationResult(saved);
    } else {
      const empty = lines.map(() => "");
      dictInputsRef.current = empty;
      setDictationInputs(empty);
      setDictationResult(null);
    }
    setDictationOn(true);
  };

  const exitDictation = () => {
    stopDictation();
    setDictationOn(false);
  };

  const playDictation = async () => {
    if (dictationPlaying) {
      stopDictation();
      return;
    }
    if (!lines.length) return;
    dictRef.current = true;
    setDictationPlaying(true);
    do {
      for (let i = 0; i < lines.length; i++) {
        if (!dictRef.current) return;
        setDictationIndex(i);
        await playLine(lines[i]);
        if (!dictRef.current) return;
      }
      if (dictLoopRef.current && !allDictationFilled()) {
        await delay(800);
        continue;
      }
      break;
    } while (dictRef.current);
    stopDictation();
  };

  const toggleDictationLoop = () => {
    const next = !dictationLoop;
    dictLoopRef.current = next;
    setDictationLoop(next);
  };

  const setDictationInput = (index: number, value: string) => {
    setDictationInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      dictInputsRef.current = next;
      return next;
    });
    if (dictationResult) setDictationResult(null);
  };

  const clearDictation = () => {
    stopDictation();
    const empty = lines.map(() => "");
    dictInputsRef.current = empty;
    setDictationInputs(empty);
    setDictationResult(null);
  };

  const dictationMutation = useMutation({
    mutationFn: async (payload: { score: number; lines: DictationSavedLine[] }) =>
      unwrap(await courseApi.submitDictation({ lessonId: lessonId!, ...payload })),
  });

  const checkDictation = () => {
    if (!lines.length) return;
    stopDictation();
    const evaluated = evaluateDictation(lines, dictInputsRef.current);
    setDictationResult(evaluated);
    dictationMutation.mutate({
      score: evaluated.score,
      lines: evaluated.lines.map((l) => ({
        target: l.target,
        typed: l.typed,
        correct: l.correct,
        total: l.total,
      })),
    });
  };

  if (courseQuery.isLoading || audioQuery.isLoading) return <LoadingView />;
  if (courseQuery.isError || !lesson) {
    return <ErrorView message="Could not load lesson" onRetry={() => courseQuery.refetch()} />;
  }

  const activeIndex = scenePlaying ? sceneIndex : rpActive ? rpIndex : null;
  const activeLine = activeIndex != null ? lines[activeIndex] : null;
  const activeSpeaker = activeLine?.speaker || null;
  const bg = backgroundUrl(lesson.background);
  const scoring = rolePlayMutation.isPending;

  return (
    <ScrollView
      contentContainerStyle={[styles.pad, { backgroundColor: t.neutral.bg, paddingBottom: tabBarHeight }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title + pass badge */}
      <View style={styles.titleRow}>
        <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800", flex: 1 }}>
          {lesson.title}
        </Text>
        {passed ? (
          <View style={[styles.badge, { backgroundColor: t.alpha("#2e9e5b", 0.16) }]}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#2e9e5b" />
            <Text style={{ color: "#2e9e5b", fontWeight: "700", fontSize: 13 }}>Passed</Text>
          </View>
        ) : null}
      </View>

      {playbackError ? (
        <Text style={{ color: t.palette.primary, marginTop: 8 }}>{playbackError}</Text>
      ) : null}

      {!dictationOn ? (
        <View style={[styles.tip, { backgroundColor: t.primaryAlpha(0.08), borderRadius: t.radii.md }]}>
          <MaterialCommunityIcons name="information-outline" size={16} color={t.palette.primary} />
          <Text variant="bodySmall" style={{ color: t.neutral.textMinor, flex: 1 }}>
            Tap any word in the dialogue for its meaning, IPA and a speaking tip — then save it as a
            term or highlight it to revisit later.
          </Text>
        </View>
      ) : null}

      {/* Scene stage */}
      {characters.length > 0 ? (
        <View style={[styles.stageWrap, { borderRadius: t.radii.lg }, t.shadow]}>
          <ImageBackground
            source={bg ? { uri: bg } : undefined}
            style={[styles.stage, { backgroundColor: t.neutral.surface2 }]}
            imageStyle={{ borderRadius: t.radii.lg }}
          >
            {hasAudio && !rpActive && !dictationOn ? (
              <Button
                mode="contained"
                compact
                icon={scenePlaying ? "stop" : "play"}
                onPress={playScene}
                style={styles.stagePlay}
              >
                {scenePlaying ? "Stop" : "Play scene"}
              </Button>
            ) : null}

            <View style={styles.cast}>
              {characters.map((c) => (
                <StageFigure
                  key={c.name}
                  name={c.name}
                  images={c.images}
                  active={activeSpeaker === c.name}
                  dim={!!activeSpeaker && activeSpeaker !== c.name}
                  primary={t.palette.primary}
                />
              ))}
            </View>

            {activeLine ? (
              <View style={[styles.caption, { backgroundColor: t.alpha("#000000", 0.55) }]}>
                <Text style={styles.captionName}>{activeLine.speaker}</Text>
                <Text style={styles.captionText}>{activeLine.text}</Text>
              </View>
            ) : null}
          </ImageBackground>
        </View>
      ) : null}

      {/* Live Role-play */}
      {!rpActive && !dictationOn ? (
        <AppCard style={styles.section}>
          <View style={styles.rowCenter}>
            <MaterialCommunityIcons name="drama-masks" size={20} color={t.palette.primary} />
            <Text style={{ color: t.neutral.text, fontWeight: "800", fontSize: 16 }}>Live Role-play</Text>
          </View>
          <Text style={{ color: t.neutral.textMinor, marginTop: 4, marginBottom: 12 }}>
            Pick a character and speak their lines.{" "}
            {lesson.progress?.best_score ? `Your best is ${lesson.progress.best_score}.` : "Score to pass."}
          </Text>
          <View style={styles.pickRow}>
            {characters.map((c) => (
              <Button
                key={c.name}
                mode="contained"
                disabled={scoring}
                onPress={() => beginRolePlay(c.name!)}
                style={styles.pickBtn}
              >
                Play {c.name}
              </Button>
            ))}
          </View>
        </AppCard>
      ) : null}

      {scoring ? (
        <AppCard style={styles.section}>
          <View style={styles.rowCenter}>
            <ActivityIndicator color={t.palette.primary} />
            <Text style={{ color: t.neutral.textMinor }}>Scoring your role-play…</Text>
          </View>
        </AppCard>
      ) : null}

      {/* Result */}
      {result && !rpActive && !dictationOn ? (
        <AppCard style={styles.section}>
          <View style={styles.resultRow}>
            <Text style={[styles.resultScore, { color: result.passed ? "#2e9e5b" : t.palette.primary }]}>
              {result.score}
            </Text>
            <View style={styles.flex}>
              <Text style={{ color: t.neutral.text, fontWeight: "800", fontSize: 16 }}>
                {result.passed ? "Passed!" : "Keep practicing"}
              </Text>
              <Text style={{ color: t.neutral.textMinor }}>Pass mark: {result.threshold || PASS_THRESHOLD}</Text>
            </View>
          </View>
        </AppCard>
      ) : null}

      {/* Listen & type toggle */}
      {!rpActive && hasAudio ? (
        <Button
          mode={dictationOn ? "contained" : "contained-tonal"}
          icon="ear-hearing"
          onPress={dictationOn ? exitDictation : enterDictation}
          style={styles.section}
        >
          {dictationOn ? "Exit listen & type" : "Listen & type"}
          {!dictationOn && lesson.progress?.last_dictation?.score != null
            ? `  ·  Last ${lesson.progress.last_dictation.score}%`
            : ""}
        </Button>
      ) : null}

      {/* Listen & type control bar */}
      {dictationOn ? (
        <AppCard style={styles.section}>
          <Text style={{ color: t.neutral.textMinor }}>
            Play the dialogue and type what you hear into every line.
          </Text>
          <Text style={{ color: t.neutral.text, fontWeight: "700", marginTop: 4 }}>
            {dictationFilled}/{lines.length} filled
          </Text>
          <View style={styles.dictBar}>
            <Button mode="contained" compact icon={dictationPlaying ? "stop" : "replay"} onPress={playDictation}>
              {dictationPlaying ? "Stop" : "Play all"}
            </Button>
            <Button
              mode={dictationLoop ? "contained-tonal" : "outlined"}
              compact
              icon={dictationLoop ? "repeat" : "repeat-off"}
              onPress={toggleDictationLoop}
            >
              Repeat
            </Button>
            <Button
              mode="contained"
              compact
              icon="check-circle"
              onPress={checkDictation}
              disabled={dictationFilled === 0}
            >
              Check
            </Button>
            <Button mode="outlined" compact icon="delete-outline" onPress={clearDictation}>
              Clear
            </Button>
          </View>
        </AppCard>
      ) : null}

      {dictationOn && dictationResult ? (
        <AppCard style={styles.section}>
          <View style={styles.resultRow}>
            <Text
              style={[
                styles.resultScore,
                { color: dictationResult.score >= DICTATION_GOOD ? "#2e9e5b" : t.palette.primary },
              ]}
            >
              {dictationResult.score}%
            </Text>
            <View style={styles.flex}>
              <Text style={{ color: t.neutral.text, fontWeight: "800", fontSize: 16 }}>
                {dictationResult.score >= DICTATION_GOOD ? "Great listening!" : "Keep listening"}
              </Text>
              <Text style={{ color: t.neutral.textMinor }}>Words heard correctly across all lines</Text>
            </View>
          </View>
        </AppCard>
      ) : null}

      {/* Transcript */}
      <View style={styles.section}>
        {lines.map((line, i) => {
          const isRight = line.align === "right";
          const isCurrent =
            (scenePlaying && sceneIndex === i) ||
            (rpActive && rpIndex === i) ||
            (dictationOn && dictationIndex === i) ||
            (playingLine != null && playingLine === line.text);
          const isMine = rpActive && line.speaker === rpCharacter;
          const lineDiff = dictationOn ? dictationResult?.lines?.[i] : null;
          return (
            <View key={i} style={[styles.line, isRight && styles.lineRight]}>
              {!isRight ? (
                <View style={[styles.avatar, { backgroundColor: avatarColor(line.speaker) }]}>
                  <Text style={styles.avatarText}>{initials(line.speaker)}</Text>
                </View>
              ) : null}
              <AppCard
                flat
                padding={12}
                style={[
                  styles.bubble,
                  isCurrent
                    ? {
                        borderColor: t.palette.primary,
                        borderWidth: 1.5,
                        backgroundColor: t.primaryAlpha(0.1),
                      }
                    : null,
                ]}
              >
                <View style={styles.speakerRow}>
                  <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 13 }}>
                    {line.speaker}
                  </Text>
                  {isCurrent ? <PlayingIndicator color={t.palette.primary} /> : null}
                </View>

                {dictationOn ? (
                  <>
                    <TextInput
                      value={dictationInputs[i] || ""}
                      onChangeText={(v) => setDictationInput(i, v)}
                      placeholder="Type what you hear…"
                      placeholderTextColor={t.neutral.textMuted}
                      multiline
                      style={[
                        styles.input,
                        { color: t.neutral.text, borderColor: t.neutral.border, backgroundColor: t.neutral.surface2 },
                      ]}
                    />
                    {lineDiff ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.diffLabel}>Answer</Text>
                        <Text style={styles.diffText}>
                          {lineDiff.targetTokens.map((tok, k) => (
                            <Text
                              key={k}
                              style={{
                                color: tok.status === "missing" ? "#d14343" : t.neutral.text,
                                fontWeight: tok.status === "missing" ? "700" : "400",
                              }}
                            >
                              {tok.word}{" "}
                            </Text>
                          ))}
                        </Text>
                        {lineDiff.typedTokens.some((tk) => tk.status === "wrong") ? (
                          <>
                            <Text style={[styles.diffLabel, { marginTop: 4 }]}>You</Text>
                            <Text style={styles.diffText}>
                              {lineDiff.typedTokens.map((tok, k) => (
                                <Text
                                  key={k}
                                  style={{
                                    color: tok.status === "wrong" ? "#d14343" : t.neutral.textMinor,
                                    textDecorationLine: tok.status === "wrong" ? "line-through" : "none",
                                  }}
                                >
                                  {tok.word}{" "}
                                </Text>
                              ))}
                            </Text>
                          </>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <MarkedText
                    text={line.text || ""}
                    marks={lineMarks()}
                    onWordPress={(word) => openVocab(word, line.text)}
                    style={{ color: t.neutral.text, marginTop: 4, lineHeight: 21 }}
                  />
                )}

                {!rpActive && !dictationOn ? (
                  <View style={styles.lineActions}>
                    <Button
                      mode="text"
                      compact
                      icon={playingLine === line.text ? "stop" : "volume-high"}
                      disabled={!hasAudio}
                      onPress={() => (playingLine === line.text ? stopPlayback() : playLine(line))}
                      style={styles.linePlay}
                    >
                      {playingLine === line.text ? "Stop" : "Listen"}
                    </Button>
                    <Button
                      mode="text"
                      compact
                      icon={lineRecordingIndex === i ? "stop" : "microphone-outline"}
                      loading={analyzeLineMutation.isPending && analyzeLineMutation.variables?.index === i}
                      disabled={
                        !line.text ||
                        (lineRecordingIndex != null && lineRecordingIndex !== i) ||
                        (analyzeLineMutation.isPending && analyzeLineMutation.variables?.index !== i)
                      }
                      onPress={() =>
                        lineRecordingIndex === i ? stopLineRecording(i, line.text || "") : startLineRecording(i)
                      }
                      style={styles.linePlay}
                    >
                      {lineRecordingIndex === i ? "Stop" : "Practice"}
                    </Button>
                  </View>
                ) : null}

                {!rpActive && !dictationOn && lineResults[i] ? (
                  <View style={styles.lineScoreRow}>
                    <Text
                      style={[
                        styles.lineScoreValue,
                        {
                          color:
                            Math.round(lineResults[i].accuracyScore ?? 0) >= PASS_THRESHOLD
                              ? "#2e9e5b"
                              : t.palette.primary,
                        },
                      ]}
                    >
                      {Math.round(lineResults[i].accuracyScore ?? 0)}
                    </Text>
                    <Text style={{ color: t.neutral.textMinor, flex: 1 }} numberOfLines={2}>
                      {lineResults[i].overallFeedback || "Accuracy score for this sentence"}
                    </Text>
                  </View>
                ) : null}

                {isCurrent && isMine ? (
                  <Button
                    mode="contained"
                    compact
                    icon="microphone"
                    onPress={() => (rpRecording ? stopRecording() : startRecording())}
                    style={{ marginTop: 8, alignSelf: "flex-start" }}
                  >
                    {rpRecording ? "Stop & next" : "Record your line"}
                  </Button>
                ) : null}
              </AppCard>
              {isRight ? (
                <View style={[styles.avatar, { backgroundColor: avatarColor(line.speaker) }]}>
                  <Text style={styles.avatarText}>{initials(line.speaker)}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Role-play active bar */}
      {rpActive ? (
        <AppCard style={styles.section}>
          <View style={styles.resultRow}>
            <Text style={{ color: t.neutral.text, fontWeight: "700", flex: 1 }}>
              Role-play as {rpCharacter}
            </Text>
            <Button mode="outlined" compact onPress={cancelRolePlay}>
              Cancel
            </Button>
          </View>
          {rpIndex != null && lines[rpIndex]?.speaker !== rpCharacter ? (
            <Text style={{ color: t.neutral.textMinor, marginTop: 8 }}>Playing coach line…</Text>
          ) : null}
        </AppCard>
      ) : null}

      {/* Study notes & exercises (read-only) */}
      {(lesson.exercises?.length ?? 0) > 0 && !rpActive && !dictationOn ? (
        <AppCard style={styles.section}>
          <PressableScale onPress={() => setShowExercises((v) => !v)} style={styles.exercisesHead}>
            <Text style={{ color: t.neutral.text, fontWeight: "800", fontSize: 15, flex: 1 }}>
              Study notes &amp; exercises ({lesson.exercises!.length})
            </Text>
            <MaterialCommunityIcons
              name={showExercises ? "chevron-up" : "chevron-down"}
              size={22}
              color={t.neutral.textMinor}
            />
          </PressableScale>
          {showExercises
            ? lesson.exercises!.map((ex, i) => (
                <View key={i} style={[styles.exerciseItem, { borderTopColor: t.neutral.border }]}>
                  {ex.prompt ? (
                    <Text style={{ color: t.neutral.text, fontWeight: "700" }}>{ex.prompt}</Text>
                  ) : null}
                  {ex.kind === "fill_blank" && ex.sentence ? (
                    <Text style={{ color: t.neutral.textMinor, marginTop: 4 }}>
                      {ex.sentence}
                      {(ex.blanks?.length ?? 0) > 0 ? (
                        <Text style={{ fontStyle: "italic" }}>
                          {"  →  "}
                          {ex.blanks!.map((b) => b.answer).filter(Boolean).join(", ")}
                        </Text>
                      ) : null}
                    </Text>
                  ) : null}
                  {ex.kind === "choice"
                    ? (ex.questions ?? []).map((q, qi) => (
                        <View key={qi} style={{ marginTop: 6 }}>
                          <Text style={{ color: t.neutral.text }}>{q.text}</Text>
                          {(q.answers ?? []).map((a, ai) => (
                            <Text key={ai} style={{ color: t.neutral.textMinor, marginLeft: 10 }}>
                              • {a}
                            </Text>
                          ))}
                        </View>
                      ))
                    : null}
                </View>
              ))
            : null}
        </AppCard>
      ) : null}

      <NotePanel
        targetType="course_lesson"
        targetKey={lesson.key}
        title={lesson.title}
        targetUrl={`/courses/${courseSlug}/${lessonId}`}
      />

      {/* Per-sentence role-play breakdown */}
      {sessions.length > 0 && !rpActive && !dictationOn ? (
        <AppCard style={styles.section}>
          <Text style={{ color: t.neutral.text, fontWeight: "800", fontSize: 16, marginBottom: 8 }}>
            Pronunciation breakdown
          </Text>
          {sessions.map((s) => {
            const acc = Math.round(s.result?.accuracyScore ?? 0);
            return (
              <View key={s.id} style={[styles.sessionRow, { borderTopColor: t.neutral.border }]}>
                <Text style={{ color: t.neutral.text, flex: 1 }} numberOfLines={2}>
                  {s.text}
                </Text>
                <Text style={{ color: acc >= PASS_THRESHOLD ? "#2e9e5b" : t.palette.primary, fontWeight: "800" }}>
                  {acc}
                </Text>
              </View>
            );
          })}
        </AppCard>
      ) : null}

      <VocabModal
        selected={selected}
        highlighted={selected ? isHighlighted(selected.text) : false}
        noteDraft={noteDraft}
        onNoteChange={setNoteDraft}
        showHighlightControls
        onClose={() => setSelected(null)}
        onRetry={() => selected && openVocab(selected.text, selected.context)}
        onListen={(text) => speakText(text)}
        onToggleHighlight={(remove) =>
          selected && highlightMutation.mutate({ text: selected.text, note: noteDraft, remove })
        }
        onSaveTerm={() => saveTermMutation.mutate()}
        saving={saveTermMutation.isPending}
        termMatch={selected ? findTermMatch(selected.text) : null}
      />
      <Snackbar visible={!!vocabSnack} onDismiss={() => setVocabSnack(null)} duration={2500}>
        {vocabSnack}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  flex: { flex: 1 },
  section: { marginTop: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, marginTop: 12 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  // Stage
  stageWrap: { marginTop: 16, overflow: "hidden" },
  stage: { minHeight: 200, justifyContent: "flex-end", padding: 12 },
  stagePlay: { position: "absolute", top: 12, right: 12, zIndex: 2 },
  cast: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end" },
  figure: { alignItems: "center", width: 130 },
  figureArt: { width: 110, height: 150, justifyContent: "center", alignItems: "center" },
  figureFallback: { width: 76, height: 76, borderRadius: 38, justifyContent: "center", alignItems: "center" },
  figureFallbackText: { color: "#fff", fontWeight: "800", fontSize: 30 },
  figureName: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  figureNameText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  caption: { marginTop: 10, padding: 10, borderRadius: 12 },
  captionName: { color: "#fff", fontWeight: "800", fontSize: 13, marginBottom: 2 },
  captionText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  // Role-play card
  pickRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pickBtn: { minHeight: 44 },
  // Result
  resultRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  resultScore: { fontSize: 40, fontWeight: "800" },
  // Dictation
  dictBar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    fontSize: 15,
  },
  diffLabel: { fontSize: 11, fontWeight: "700", opacity: 0.6, textTransform: "uppercase" },
  diffText: { fontSize: 15, lineHeight: 22 },
  // Transcript
  line: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 12 },
  lineRight: { flexDirection: "row-reverse" },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  bubble: { flex: 1 },
  speakerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eq: { flexDirection: "row", alignItems: "center", height: 16, gap: 2 },
  eqBar: { width: 3, height: 14, borderRadius: 2 },
  lineActions: { flexDirection: "row", alignItems: "center", marginLeft: -8 },
  linePlay: { alignSelf: "flex-start", marginTop: 4 },
  lineScoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  lineScoreValue: { fontSize: 20, fontWeight: "800" },
  // Sessions
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Exercises
  exercisesHead: { flexDirection: "row", alignItems: "center" },
  exerciseItem: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});

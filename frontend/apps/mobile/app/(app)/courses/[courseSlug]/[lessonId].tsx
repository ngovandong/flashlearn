import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Text, useTheme } from "react-native-paper";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { courseApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { AudioRecorder, playSpeechClip, speakText, type PlaybackResult } from "@/utils/audio";
import { unwrap } from "@/utils/apiError";

interface LessonLine {
  speaker?: string;
  text?: string;
  voice?: string;
}

interface LessonCharacter {
  name?: string;
  role?: string;
}

interface AudioClipLine {
  voice?: string;
  text?: string;
  audio_url?: string;
  audio?: string;
  mime_type?: string;
}

interface CourseLesson {
  id: string;
  title?: string;
  lines?: LessonLine[];
  characters?: LessonCharacter[];
  progress?: {
    best_score?: number;
    status?: string;
    last_result?: { score?: number; passed?: boolean; threshold?: number };
  };
}

function clipKey(voice?: string, text?: string): string {
  return `${voice || ""}|${text || ""}`;
}

export default function CourseLessonScreen() {
  const { courseSlug, lessonId } = useLocalSearchParams<{ courseSlug: string; lessonId: string }>();
  const theme = useTheme();

  const [mode, setMode] = useState<"listen" | "roleplay">("listen");
  const [lineIndex, setLineIndex] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [rpCharacter, setRpCharacter] = useState<string | null>(null);
  const [rpActive, setRpActive] = useState(false);
  const [rpLineIndex, setRpLineIndex] = useState<number | null>(null);
  const [rpRecording, setRpRecording] = useState(false);
  const [rpResult, setRpResult] = useState<{ score: number; passed: boolean; threshold: number } | null>(null);
  const recorder = useRef(new AudioRecorder());
  const rpTurns = useRef<{ target_text: string; audio: string; mime_type: string }[]>([]);

  const courseQuery = useQuery({
    queryKey: ["course", courseSlug],
    queryFn: async () => unwrap(await courseApi.getCourse(courseSlug!)),
    enabled: !!courseSlug,
  });

  const audioQuery = useQuery({
    queryKey: ["course", "lesson-audio", lessonId],
    queryFn: async () => unwrap<{ lines: AudioClipLine[] }>(await courseApi.getLessonAudio(lessonId!)),
    enabled: !!lessonId,
  });

  const lesson: CourseLesson | undefined = useMemo(() => {
    for (const section of courseQuery.data?.sections ?? []) {
      const found = (section.lessons ?? []).find((l: { id: string }) => String(l.id) === String(lessonId));
      if (found) return found as CourseLesson;
    }
    return undefined;
  }, [courseQuery.data, lessonId]);

  const audioMap = useMemo(() => {
    const map = new Map<string, AudioClipLine>();
    for (const line of audioQuery.data?.lines ?? []) {
      map.set(clipKey(line.voice, line.text), line);
    }
    return map;
  }, [audioQuery.data]);

  const lines = lesson?.lines ?? [];
  const current = lines[lineIndex];
  const characters = (lesson?.characters ?? []).map((c) => c.name).filter(Boolean) as string[];

  const playLine = useCallback(
    async (line: LessonLine): Promise<PlaybackResult> => {
      setPlaybackError(null);
      const clip = audioMap.get(clipKey(line.voice, line.text));
      if (clip) {
        const result = await playSpeechClip(
          { audio_url: clip.audio_url, audio: clip.audio, mime_type: clip.mime_type },
          line.text
        );
        if (!result.ok) setPlaybackError(result.error);
        return result;
      }
      if (line.text) {
        await speakText(line.text);
        return { ok: true };
      }
      return { ok: false, error: "Nothing to play." };
    },
    [audioMap]
  );

  useEffect(() => {
    if (mode !== "listen" || !current) return;
    playLine(current);
  }, [mode, lineIndex, current, playLine]);

  const rolePlayMutation = useMutation({
    mutationFn: async (segments: { target_text: string; audio: string; mime_type: string }[]) => {
      const res = await courseApi.submitRolePlay({ lessonId: lessonId!, segments });
      return unwrap<{
        score: number;
        passed: boolean;
        threshold: number;
        progress?: CourseLesson["progress"];
      }>(res);
    },
    onSuccess: (data) => {
      setRpResult({ score: data.score, passed: data.passed, threshold: data.threshold });
      courseQuery.refetch();
    },
  });

  const beginRolePlay = (character: string) => {
    setRpCharacter(character);
    setRpActive(true);
    setRpResult(null);
    rpTurns.current = [];
    setRpLineIndex(0);
    stepRolePlay(0, character);
  };

  const stepRolePlay = async (index: number, character: string) => {
    if (index >= lines.length) {
      setRpActive(false);
      setRpLineIndex(null);
      if (rpTurns.current.length) {
        rolePlayMutation.mutate(rpTurns.current);
      }
      return;
    }
    setRpLineIndex(index);
    const line = lines[index];
    if (line.speaker === character) return;
    await playLine(line);
    stepRolePlay(index + 1, character);
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
    if (!recorded || rpLineIndex === null) return;
    const line = lines[rpLineIndex];
    if (line?.text) {
      rpTurns.current.push({
        target_text: line.text,
        audio: recorded.base64,
        mime_type: recorded.mimeType,
      });
    }
    if (rpCharacter) stepRolePlay(rpLineIndex + 1, rpCharacter);
  };

  if (courseQuery.isLoading || audioQuery.isLoading) return <LoadingView />;
  if (courseQuery.isError || !lesson) {
    return <ErrorView message="Could not load lesson" onRetry={() => courseQuery.refetch()} />;
  }

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
        {lesson.title}
      </Text>

      <View style={styles.modeRow}>
        <Chip selected={mode === "listen"} onPress={() => setMode("listen")}>
          Listen
        </Chip>
        <Chip selected={mode === "roleplay"} onPress={() => setMode("roleplay")}>
          Role-play
        </Chip>
      </View>

      {playbackError ? (
        <Text style={{ color: theme.colors.error, marginTop: 8 }}>{playbackError}</Text>
      ) : null}

      {mode === "listen" ? (
        <>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
            Line {lineIndex + 1} / {lines.length}
          </Text>
          {current?.speaker ? (
            <Text variant="titleSmall" style={{ color: theme.colors.primary, marginTop: 8 }}>
              {current.speaker}
            </Text>
          ) : null}
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 8 }}>
            {current?.text}
          </Text>
          <View style={styles.row}>
            <Button mode="outlined" disabled={lineIndex === 0} onPress={() => setLineIndex((i) => i - 1)}>
              Previous
            </Button>
            <Button mode="contained-tonal" icon="volume-up" onPress={() => current && playLine(current)}>
              Replay
            </Button>
            <Button
              mode="contained"
              disabled={lineIndex >= lines.length - 1}
              onPress={() => setLineIndex((i) => i + 1)}
            >
              Next
            </Button>
          </View>
        </>
      ) : (
        <>
          {!rpActive && !rpResult ? (
            <>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                Pick your character, then speak every line assigned to you.
              </Text>
              <View style={styles.chars}>
                {characters.map((name) => (
                  <Button key={name} mode="contained-tonal" onPress={() => beginRolePlay(name)} style={styles.charBtn}>
                    {name}
                  </Button>
                ))}
              </View>
            </>
          ) : null}

          {rpActive && rpLineIndex !== null ? (
            <>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                Line {rpLineIndex + 1} / {lines.length}
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 8 }}>
                {lines[rpLineIndex]?.text}
              </Text>
              {lines[rpLineIndex]?.speaker === rpCharacter ? (
                <View style={styles.row}>
                  <Button mode="outlined" icon="mic" onPress={startRecording} disabled={rpRecording}>
                    {rpRecording ? "Recording…" : "Record"}
                  </Button>
                  <Button mode="contained" onPress={stopRecording} disabled={!rpRecording}>
                    Stop
                  </Button>
                </View>
              ) : (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                  Playing coach line…
                </Text>
              )}
            </>
          ) : null}

          {rolePlayMutation.isPending ? (
            <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Scoring…</Text>
          ) : null}

          {rpResult ? (
            <View style={[styles.result, { borderColor: theme.colors.outlineVariant }]}>
              <Text variant="titleLarge" style={{ color: rpResult.passed ? "#2e7d32" : theme.colors.primary }}>
                Score: {rpResult.score}% {rpResult.passed ? "— Passed!" : ""}
              </Text>
              {!rpResult.passed ? (
                <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  Reach {rpResult.threshold}% to pass.
                </Text>
              ) : null}
              <Button mode="text" onPress={() => { setRpResult(null); setRpCharacter(null); }} style={{ marginTop: 8 }}>
                Try again
              </Button>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  chars: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  charBtn: { minHeight: 44 },
  result: { marginTop: 16, padding: 16, borderWidth: 1, borderRadius: 12 },
});

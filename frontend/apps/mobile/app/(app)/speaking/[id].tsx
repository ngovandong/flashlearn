import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { SpeakingConversation, SpeakingLine } from "@flashlearn/core";
import { speakingApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { AudioRecorder, playSpeechClip, speakText } from "@/utils/audio";
import { unwrap } from "@/utils/apiError";

export default function SpeakingConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [lineIndex, setLineIndex] = useState(0);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [rpRecording, setRpRecording] = useState(false);
  const recorder = useRef(new AudioRecorder());
  const audioCache = useRef(new Map<string, { audio_url?: string; audio?: string; mime_type?: string }>());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["speaking", id],
    queryFn: async () => unwrap<SpeakingConversation>(await speakingApi.getConversation(id!)),
    enabled: !!id,
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

  const playCurrentLine = async () => {
    if (!current?.text) return;
    setPlaybackError(null);
    const voice = current.voice || "Kore";
    const cacheKey = `${voice}:${current.text}`;
    let clip = audioCache.current.get(cacheKey);
    if (!clip) {
      const res = await speakingApi.generateSpeech(current.text, voice);
      const payload = unwrap<{ audio_url?: string; audio?: string; mime_type?: string }>(res);
      clip = payload;
      audioCache.current.set(cacheKey, clip);
    }
    const result = await playSpeechClip(
      { audio_url: clip.audio_url, audio: clip.audio, mime_type: clip.mime_type },
      current.text
    );
    if (!result.ok) setPlaybackError(result.error);
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

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
        {data.topic}
      </Text>
      <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
        Line {lineIndex + 1} / {lines.length}
      </Text>
      {current?.role ? (
        <Text variant="titleSmall" style={{ color: theme.colors.primary, marginTop: 8 }}>
          {current.role}
        </Text>
      ) : null}
      <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 8 }}>
        {current?.text}
      </Text>

      {playbackError ? (
        <Text style={{ color: theme.colors.error, marginTop: 8 }}>{playbackError}</Text>
      ) : null}

      <Button mode="contained-tonal" icon="volume-up" onPress={playCurrentLine} style={{ marginTop: 12 }}>
        Listen (TTS)
      </Button>
      <Button mode="text" onPress={() => current?.text && speakText(current.text)} style={{ marginTop: 4 }}>
        Fallback voice
      </Button>

      <View style={styles.row}>
        <Button mode="outlined" icon="mic" onPress={startRecording} disabled={rpRecording}>
          {rpRecording ? "Recording…" : "Record"}
        </Button>
        <Button mode="contained" onPress={stopAndAnalyze} loading={analyzeMutation.isPending} disabled={!rpRecording}>
          Stop & analyze
        </Button>
      </View>

      {analysis ? (
        <View style={[styles.analysis, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
            Pronunciation
          </Text>
          {["accuracyScore", "fluencyScore", "completenessScore"].map((key) =>
            analysis[key] !== undefined ? (
              <Text key={key} style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                {key.replace("Score", "")}: {String(analysis[key])}
              </Text>
            ) : null
          )}
        </View>
      ) : null}

      <Button
        mode="text"
        onPress={() => { setLineIndex((i) => Math.min(i + 1, lines.length - 1)); setAnalysis(null); }}
        disabled={lineIndex >= lines.length - 1}
        style={{ marginTop: 12 }}
      >
        Next line
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  row: { flexDirection: "row", gap: 10, marginTop: 16 },
  analysis: { marginTop: 16, padding: 12, borderRadius: 10 },
});

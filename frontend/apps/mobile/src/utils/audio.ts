import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioRecorder as NativeAudioRecorder,
} from "expo-audio";
import * as Speech from "expo-speech";
import { Platform } from "react-native";
import { EncodingType, File, Paths } from "expo-file-system";
import { prepareSpeechClip, encodeBase64, type SpeechClipInput } from "@flashlearn/core";

// RecordingPresets.HIGH_QUALITY records an MPEG-4/AAC container on iOS &
// Android ('.m4a') but WebM/Opus in the browser — "audio/m4a" isn't a MIME
// type the Gemini audio-understanding API recognizes, so it silently fails
// to decode the bytes and reports back that no speech was heard.
const RECORDING_MIME_TYPE = Platform.OS === "web" ? "audio/webm" : "audio/mp4";

export type PlaybackResult = { ok: true } | { ok: false; error: string };

let activePlayer: AudioPlayer | null = null;
let activeTempFile: File | null = null;

function releaseActivePlayer(): void {
  activePlayer?.release();
  activePlayer = null;
  if (activeTempFile?.exists) {
    activeTempFile.delete();
  }
  activeTempFile = null;
}

/** Stop and release any clip that is currently playing (best-effort). */
export function stopPlayback(): void {
  Speech.stop();
  releaseActivePlayer();
}

export async function speakText(text: string, language = "en-US"): Promise<void> {
  if (!text) return;
  Speech.stop();
  await new Promise<void>((resolve) => {
    Speech.speak(text, { language, onDone: () => resolve(), onError: () => resolve() });
  });
}

export async function playAudioUrl(url: string, rate = 1): Promise<PlaybackResult> {
  try {
    releaseActivePlayer();
    const player = createAudioPlayer(url);
    activePlayer = player;
    if (rate !== 1) {
      try {
        player.setPlaybackRate(rate);
      } catch {
        /* rate control unsupported on this platform — play at normal speed */
      }
    }
    await new Promise<void>((resolve, reject) => {
      const subscription = player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          subscription.remove();
          resolve();
        }
        if ("error" in status && status.error) {
          subscription.remove();
          reject(new Error(String(status.error)));
        }
      });
      player.play();
    });
    releaseActivePlayer();
    return { ok: true };
  } catch (e) {
    releaseActivePlayer();
    return { ok: false, error: e instanceof Error ? e.message : "Playback failed." };
  }
}

async function playPreparedBytes(
  bytes: Uint8Array,
  extension: string
): Promise<PlaybackResult> {
  const file = new File(Paths.cache, `speech-${Date.now()}.${extension}`);
  const b64 = encodeBase64(bytes);
  file.write(b64, { encoding: EncodingType.Base64 });
  activeTempFile = file;

  try {
    releaseActivePlayer();
    const player = createAudioPlayer(file.uri);
    activePlayer = player;
    await new Promise<void>((resolve, reject) => {
      const subscription = player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          subscription.remove();
          resolve();
        }
        if ("error" in status && status.error) {
          subscription.remove();
          reject(new Error(String(status.error)));
        }
      });
      player.play();
    });
    releaseActivePlayer();
    return { ok: true };
  } catch (e) {
    releaseActivePlayer();
    return { ok: false, error: e instanceof Error ? e.message : "Playback failed." };
  }
}

/**
 * Play a backend speech clip — prefers `audio_url`, wraps legacy PCM as WAV.
 * Falls back to `expo-speech` when `fallbackText` is provided and clip fails.
 */
export async function playSpeechClip(
  clip: SpeechClipInput,
  fallbackText?: string
): Promise<PlaybackResult> {
  const prepared = prepareSpeechClip(clip);
  if (!prepared.ok) {
    if (fallbackText) {
      await speakText(fallbackText);
      return { ok: true };
    }
    return { ok: false, error: prepared.error };
  }

  if (prepared.clip.kind === "url") {
    const result = await playAudioUrl(prepared.clip.url);
    if (!result.ok && fallbackText) {
      await speakText(fallbackText);
      return { ok: true };
    }
    return result;
  }

  const result = await playPreparedBytes(
    prepared.clip.bytes,
    prepared.clip.extension
  );
  if (!result.ok && fallbackText) {
    await speakText(fallbackText);
    return { ok: true };
  }
  return result;
}

export async function playBase64Audio(
  base64: string,
  mimeType = "audio/mpeg"
): Promise<PlaybackResult> {
  return playSpeechClip({ audio: base64, mime_type: mimeType });
}

export class AudioRecorder {
  private recording: NativeAudioRecorder | null = null;

  async start(): Promise<void> {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission was denied.");
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    const recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recording.prepareToRecordAsync();
    recording.record();
    this.recording = recording;
  }

  async stop(): Promise<{ uri: string; base64: string; mimeType: string } | null> {
    if (!this.recording) return null;
    await this.recording.stop();
    const uri = this.recording.uri;
    this.recording = null;
    if (!uri) return null;
    const base64 = await new File(uri).base64();
    return { uri, base64, mimeType: RECORDING_MIME_TYPE };
  }

  async cancel(): Promise<void> {
    if (!this.recording) return;
    await this.recording.stop();
    this.recording = null;
  }

  get isRecording(): boolean {
    return !!this.recording;
  }
}

import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioRecorder as NativeAudioRecorder,
  type AudioStreamBuffer,
} from "expo-audio";
import * as Speech from "expo-speech";
import { Platform } from "react-native";
import { EncodingType, File, Paths } from "expo-file-system";
import {
  concatBytes,
  encodeBase64,
  encodeWavFromPcm16,
  pcm16HasSignal,
  prepareSpeechClip,
  resamplePcm16Mono,
  type SpeechClipInput,
} from "@flashlearn/core";

// Azure Speech's short-audio REST API only accepts 16 kHz mono PCM WAV (or
// OGG/Opus). Native HIGH_QUALITY recordings are AAC in an .m4a container;
// sending those as "audio/mp4" makes Azure (and often Gemini) hear silence
// and report that the microphone didn't pick up any voice.
const AZURE_WAV_RATE = 16000;
const WEB_RECORDING_MIME_TYPE = "audio/webm";

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

async function setPlaybackAudioMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
    shouldRouteThroughEarpiece: false,
  });
}

function copyPcmChunk(data: AudioStreamBuffer["data"]): Uint8Array {
  const src = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new Uint8Array(src);
}

export class AudioRecorder {
  private recording: NativeAudioRecorder | null = null;
  private stream: InstanceType<typeof AudioModule.AudioStream> | null = null;
  private streamSub: { remove: () => void } | null = null;
  private chunks: Uint8Array[] = [];
  private streamRate = AZURE_WAV_RATE;

  async start(): Promise<void> {
    stopPlayback();
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission was denied.");
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      shouldRouteThroughEarpiece: false,
    });

    if (Platform.OS === "web") {
      try {
        const recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
        await recording.prepareToRecordAsync();
        recording.record();
        this.recording = recording;
      } catch (e) {
        await setPlaybackAudioMode();
        throw e;
      }
      return;
    }

    this.chunks = [];
    this.streamRate = AZURE_WAV_RATE;
    const stream = new AudioModule.AudioStream({
      sampleRate: AZURE_WAV_RATE,
      channels: 1,
      encoding: "int16",
    });
    this.streamSub = stream.addListener("audioStreamBuffer", (buffer: AudioStreamBuffer) => {
      this.streamRate = buffer.sampleRate || AZURE_WAV_RATE;
      this.chunks.push(copyPcmChunk(buffer.data));
    });
    try {
      await stream.start();
    } catch (e) {
      this.streamSub.remove();
      this.streamSub = null;
      await setPlaybackAudioMode();
      throw e;
    }
    this.stream = stream;
  }

  async stop(): Promise<{ uri: string; base64: string; mimeType: string } | null> {
    try {
      if (this.recording) {
        await this.recording.stop();
        const uri = this.recording.uri;
        this.recording = null;
        if (!uri) return null;
        const base64 = await new File(uri).base64();
        return { uri, base64, mimeType: WEB_RECORDING_MIME_TYPE };
      }

      if (!this.stream) return null;
      this.stream.stop();
      this.streamSub?.remove();
      this.streamSub = null;
      this.stream = null;
      const chunks = this.chunks;
      const rate = this.streamRate;
      this.chunks = [];

      const pcm = concatBytes(chunks);
      if (!pcm16HasSignal(pcm)) return null;
      const pcm16k = rate === AZURE_WAV_RATE ? pcm : resamplePcm16Mono(pcm, rate, AZURE_WAV_RATE);
      const wav = encodeWavFromPcm16(pcm16k, AZURE_WAV_RATE, 1);
      const base64 = encodeBase64(wav);
      const file = new File(Paths.cache, `recording-${Date.now()}.wav`);
      file.write(base64, { encoding: EncodingType.Base64 });
      return { uri: file.uri, base64, mimeType: "audio/wav" };
    } finally {
      await setPlaybackAudioMode();
    }
  }

  async cancel(): Promise<void> {
    if (this.recording) {
      await this.recording.stop();
      this.recording = null;
    }
    if (this.stream) {
      this.stream.stop();
      this.streamSub?.remove();
      this.streamSub = null;
      this.stream = null;
      this.chunks = [];
    }
    await setPlaybackAudioMode();
  }

  get isRecording(): boolean {
    return !!this.recording || !!this.stream;
  }
}

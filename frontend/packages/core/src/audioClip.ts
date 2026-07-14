/** Platform-agnostic helpers for TTS / speech-clip playback and PCM→WAV wrapping. */

export const DEFAULT_PCM_SAMPLE_RATE = 24000;

export function sampleRateFromMime(mime: string): number {
  const match = /rate=(\d+)/i.exec(mime || "");
  return match ? parseInt(match[1], 10) : DEFAULT_PCM_SAMPLE_RATE;
}

/** Gemini legacy TTS returns raw signed 16-bit little-endian PCM. */
export function isPcmMime(mime: string): boolean {
  const m = (mime || "").toLowerCase();
  return m.includes("l16") || m.includes("pcm") || m.includes("rate=");
}

export function extensionForMime(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (isPcmMime(m)) return "wav";
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "bin";
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Wrap raw signed 16-bit little-endian PCM in a mono WAV container.
 * `pcm` length is truncated to an even byte count.
 */
export function encodeWavFromPcm16(
  pcm: Uint8Array,
  sampleRate: number,
  channels = 1
): Uint8Array {
  const usable = pcm.byteLength - (pcm.byteLength % 2);
  const dataSize = usable;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  buffer.set(pcm.subarray(0, usable), 44);
  return buffer;
}

/** Encode bytes to base64 without relying on `btoa` / DOM APIs. */
export function encodeBase64(bytes: Uint8Array): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63];
    out += chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? chars[n & 63] : "=";
  }
  return out;
}

/** Strip data-URL prefix and whitespace from a base64 string. */
export function normalizeBase64(input: string): string {
  return input.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
}

/** Decode base64 without relying on `atob` / DOM APIs. */
export function decodeBase64(input: string): Uint8Array {
  const str = normalizeBase64(input);
  if (!str) return new Uint8Array(0);

  const table = new Map<string, number>();
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < chars.length; i++) table.set(chars[i], i);

  const padding = str.endsWith("==") ? 2 : str.endsWith("=") ? 1 : 0;
  const outLen = Math.floor((str.length * 3) / 4) - padding;
  const out = new Uint8Array(outLen);

  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (const ch of str) {
    if (ch === "=") break;
    const val = table.get(ch);
    if (val === undefined) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return index === outLen ? out : out.subarray(0, index);
}

export interface SpeechClipInput {
  audio?: string | null;
  audio_url?: string | null;
  mime_type?: string | null;
}

export type PreparedSpeechClip =
  | {
      kind: "url";
      url: string;
    }
  | {
      kind: "bytes";
      bytes: Uint8Array;
      mimeType: string;
      extension: string;
    };

export type PrepareSpeechClipResult =
  | { ok: true; clip: PreparedSpeechClip }
  | { ok: false; error: string };

/**
 * Normalize a backend TTS clip (hosted URL or inline base64) into something
 * a native/web player can consume. Legacy PCM clips are wrapped as WAV.
 */
export function prepareSpeechClip(input: SpeechClipInput): PrepareSpeechClipResult {
  const url = (input.audio_url || "").trim();
  if (url) {
    return { ok: true, clip: { kind: "url", url } };
  }

  const b64 = (input.audio || "").trim();
  if (!b64) {
    return { ok: false, error: "No audio data in clip." };
  }

  const mime = input.mime_type || "audio/mpeg";
  try {
    const raw = decodeBase64(b64);
    if (!raw.byteLength) {
      return { ok: false, error: "Audio clip decoded to empty bytes." };
    }

    if (isPcmMime(mime)) {
      const wav = encodeWavFromPcm16(raw, sampleRateFromMime(mime), 1);
      return {
        ok: true,
        clip: { kind: "bytes", bytes: wav, mimeType: "audio/wav", extension: "wav" },
      };
    }

    return {
      ok: true,
      clip: {
        kind: "bytes",
        bytes: raw,
        mimeType: mime,
        extension: extensionForMime(mime),
      },
    };
  } catch {
    return { ok: false, error: "Could not decode audio clip." };
  }
}

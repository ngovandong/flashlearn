import {
  concatBytes,
  decodeBase64,
  encodeBase64,
  encodeWavFromPcm16,
  extensionForMime,
  isPcmMime,
  pcm16HasSignal,
  prepareSpeechClip,
  resamplePcm16Mono,
  sampleRateFromMime,
} from "@flashlearn/core";

describe("audioClip", () => {
  it("detects PCM mime types", () => {
    expect(isPcmMime("audio/L16;rate=24000")).toBe(true);
    expect(isPcmMime("audio/mpeg")).toBe(false);
  });

  it("parses sample rate from mime", () => {
    expect(sampleRateFromMime("audio/L16;rate=16000")).toBe(16000);
    expect(sampleRateFromMime("audio/mpeg")).toBe(24000);
  });

  it("writes a valid WAV header for PCM input", () => {
    const pcm = new Uint8Array([0, 0, 255, 127, 0, 0]);
    const wav = encodeWavFromPcm16(pcm, 24000, 1);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.subarray(8, 12))).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(6);
    expect(wav.byteLength).toBe(44 + 6);
  });

  it("wraps legacy PCM base64 as WAV bytes", () => {
    const pcm = new Uint8Array([0, 1, 2, 3]);
    const b64 = encodeBase64(pcm);
    const result = prepareSpeechClip({
      audio: b64,
      mime_type: "audio/L16;rate=16000",
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.clip.kind === "bytes") {
      expect(result.clip.extension).toBe("wav");
      expect(result.clip.mimeType).toBe("audio/wav");
      expect(String.fromCharCode(...result.clip.bytes.subarray(0, 4))).toBe("RIFF");
      const view = new DataView(result.clip.bytes.buffer);
      expect(view.getUint32(24, true)).toBe(16000);
    }
  });

  it("passes through MP3 bytes unchanged", () => {
    const raw = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    const b64 = encodeBase64(raw);
    const result = prepareSpeechClip({ audio: b64, mime_type: "audio/mpeg" });
    expect(result.ok).toBe(true);
    if (result.ok && result.clip.kind === "bytes") {
      expect(result.clip.extension).toBe("mp3");
      expect(result.clip.bytes).toEqual(raw);
    }
  });

  it("prefers audio_url over inline audio", () => {
    const result = prepareSpeechClip({
      audio_url: "https://cdn.example.com/clip.mp3",
      audio: "AAAA",
    });
    expect(result).toEqual({ ok: true, clip: { kind: "url", url: "https://cdn.example.com/clip.mp3" } });
  });

  it("maps mime types to file extensions", () => {
    expect(extensionForMime("audio/webm")).toBe("webm");
    expect(extensionForMime("audio/mp4")).toBe("m4a");
  });

  it("round-trips base64 decode", () => {
    const bytes = new Uint8Array([10, 20, 30, 40]);
    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
  });

  it("concatenates PCM chunks", () => {
    expect(concatBytes([new Uint8Array([1, 2]), new Uint8Array([3])])).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });

  it("detects silence vs a real PCM sample", () => {
    expect(pcm16HasSignal(new Uint8Array([0, 0, 0, 0]))).toBe(false);
    const loud = new Uint8Array(2);
    new DataView(loud.buffer).setInt16(0, 1200, true);
    expect(pcm16HasSignal(loud)).toBe(true);
  });

  it("resamples mono PCM16 to a different rate", () => {
    const src = new Uint8Array(8);
    const view = new DataView(src.buffer);
    view.setInt16(0, 0, true);
    view.setInt16(2, 1000, true);
    view.setInt16(4, 0, true);
    view.setInt16(6, -1000, true);
    const dest = resamplePcm16Mono(src, 8000, 16000);
    expect(dest.byteLength).toBe(16);
    expect(new DataView(dest.buffer).getInt16(0, true)).toBe(0);
  });
});

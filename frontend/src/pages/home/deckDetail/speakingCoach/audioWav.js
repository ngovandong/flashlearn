// Converts recorded MediaRecorder blobs (WebM/Opus on Chrome, MP4/AAC on
// Safari, ...) into 16 kHz mono 16-bit PCM WAV — the format Azure Speech's
// pronunciation assessment REST endpoint accepts. Decoding through the Web
// Audio API also lets us cleanly concatenate the per-turn role-play recordings
// (gluing raw WebM files produces a corrupt container).

const TARGET_RATE = 16000;

// Decode one recorded blob, resampling to 16 kHz mono PCM via an
// OfflineAudioContext (whatever codec the browser recorded in).
async function decodeToMono16k(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new Ctx();
  let decoded;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    decodeCtx.close?.();
  }
  const frames = Math.ceil(decoded.duration * TARGET_RATE);
  const offline = new OfflineAudioContext(1, Math.max(1, frames), TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

// Encode a mono Float32 PCM buffer as a 16-bit WAV (RIFF) ArrayBuffer.
function encodeWav(samples, sampleRate = TARGET_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function wavResult(samples) {
  const buffer = encodeWav(samples);
  return { base64: arrayBufferToBase64(buffer), blob: new Blob([buffer], { type: "audio/wav" }) };
}

// One recording → { base64, blob } (16 kHz mono WAV).
export async function blobToWav(blob) {
  return wavResult(await decodeToMono16k(blob));
}

// Several recordings concatenated into one valid WAV → { base64, blob }.
export async function blobsToWav(blobs) {
  const parts = [];
  let total = 0;
  for (const blob of blobs) {
    // eslint-disable-next-line no-await-in-loop
    const pcm = await decodeToMono16k(blob);
    parts.push(pcm);
    total += pcm.length;
  }
  const merged = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return wavResult(merged);
}

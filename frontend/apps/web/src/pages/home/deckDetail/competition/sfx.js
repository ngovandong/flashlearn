// Tiny procedural sound engine — everything is synthesized with the Web Audio
// API so we ship zero binary audio assets. One shared AudioContext, unlocked on
// the first user gesture (games always start after a tap, so this is safe).

let ctx = null;
let master = null;

function ensure() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// A single enveloped oscillator, optionally pitch-swept.
function tone({ freq, to, type = "sine", dur = 0.18, gain = 0.3, delay = 0 }) {
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Filtered white-noise burst — the basis for explosions / whooshes.
function noise({ dur = 0.3, gain = 0.4, from = 1800, to = 300, q = 1, delay = 0 }) {
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  unlock: () => ensure(),

  correct() {
    tone({ freq: 660, type: "triangle", dur: 0.12, gain: 0.25 });
    tone({ freq: 880, type: "triangle", dur: 0.16, gain: 0.25, delay: 0.08 });
    tone({ freq: 1320, type: "sine", dur: 0.18, gain: 0.2, delay: 0.16 });
  },
  wrong() {
    tone({ freq: 200, to: 90, type: "sawtooth", dur: 0.32, gain: 0.28 });
    noise({ dur: 0.18, gain: 0.12, from: 500, to: 120 });
  },
  shoot() {
    tone({ freq: 1200, to: 260, type: "square", dur: 0.14, gain: 0.16 });
  },
  explode() {
    noise({ dur: 0.4, gain: 0.5, from: 2200, to: 120, q: 0.7 });
    tone({ freq: 160, to: 50, type: "sawtooth", dur: 0.35, gain: 0.2 });
  },
  combo(mult = 2) {
    const base = 520 + mult * 90;
    tone({ freq: base, type: "square", dur: 0.1, gain: 0.16 });
    tone({ freq: base * 1.5, type: "square", dur: 0.12, gain: 0.14, delay: 0.06 });
  },
  boost() {
    noise({ dur: 0.35, gain: 0.28, from: 300, to: 2600, q: 0.6 });
    tone({ freq: 300, to: 900, type: "sawtooth", dur: 0.3, gain: 0.12 });
  },
  beep(high = false) {
    tone({ freq: high ? 880 : 520, type: "square", dur: 0.12, gain: 0.22 });
  },
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) =>
      tone({ freq: f, type: "triangle", dur: 0.22, gain: 0.24, delay: i * 0.1 })
    );
  },
};

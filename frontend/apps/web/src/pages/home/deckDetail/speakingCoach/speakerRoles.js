// Shared speaker helpers for the Speaking Coach and speaking-course transcript.
// Role-play and left/right layout both key off the speaker name on each line,
// so matching has to ignore case/whitespace or a loaded conversation (Dong/John)
// never matches the setup form's default "Me"/"Coach".

export function sameSpeaker(a, b) {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

export function uniqueSpeakers(lines) {
  const names = [];
  for (const line of lines || []) {
    const name = (line?.speaker || "").trim();
    if (name && !names.some((n) => sameSpeaker(n, name))) names.push(name);
  }
  return names;
}

// First unique speaker stays on the left; everyone else on the right — the same
// left/right transcript layout the speaking course uses via each line's `align`.
export function speakerAlign(speaker, speakers) {
  const idx = (speakers || []).findIndex((s) => sameSpeaker(s, speaker));
  return idx > 0 ? "right" : "left";
}

// Deterministic avatar tint from a character name (brand-hue range so it reads
// on-theme in light and dark mode).
export function avatarStyle(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return { background: `hsl(${hash}, 55%, 55%)` };
}

export function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

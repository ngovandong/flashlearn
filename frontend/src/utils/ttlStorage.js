/**
 * Tiny localStorage wrapper with a per-key TTL (time-to-live).
 *
 * Values are stored as `{ v: <value>, e: <expiryEpochMs> }`. A read past the
 * expiry transparently removes the key and returns the provided default, so
 * callers never see stale data.
 */

export function setWithTTL(key, value, ttlMs) {
  try {
    const payload = { v: value, e: Date.now() + ttlMs };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

export function getWithTTL(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const { v, e } = JSON.parse(raw);
    if (typeof e !== "number" || Date.now() > e) {
      localStorage.removeItem(key);
      return fallback;
    }
    return v;
  } catch {
    return fallback;
  }
}

export function removeTTL(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Milliseconds remaining until the next local midnight (start of new day). */
export function msUntilNextLocalMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

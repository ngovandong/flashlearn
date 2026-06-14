/**
 * Home-page practice banner rotation.
 *
 * Only one banner shows at a time. Each new day defaults to the Speaking Coach
 * banner; once the user practices Speaking Coach, we flip to the number-listening
 * banner for the rest of the day. The flag is stored with a TTL that expires at
 * the next local midnight, so it resets every new day.
 */

import { getWithTTL, setWithTTL, msUntilNextLocalMidnight } from "./ttlStorage";

const SPEAKING_PRACTICED_KEY = "flashlearn_speaking_practiced_v1";

export function markSpeakingCoachPracticed() {
  setWithTTL(SPEAKING_PRACTICED_KEY, true, msUntilNextLocalMidnight());
}

export function hasPracticedSpeakingToday() {
  return getWithTTL(SPEAKING_PRACTICED_KEY, false) === true;
}

/** Which banner to show now: "speaking" (default) or "number" (after practice). */
export function getActivePracticeBanner() {
  return hasPracticedSpeakingToday() ? "number" : "speaking";
}

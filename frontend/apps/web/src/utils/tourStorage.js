/**
 * Per-step persistence for onboarding tours.
 *
 * We store the set of completed step ids in one localStorage key. A step is
 * marked done when the user advances past it (clicks "Next"/"Got it"). This
 * lets a page tour show only the steps that are still left on later visits, and
 * stop auto-showing entirely once every step is done.
 */

const STEPS_KEY = "flashlearn_tour_steps_v1";
const DISABLED_KEY = "flashlearn_tours_disabled_v1";

/** Has the user opted out of ALL onboarding tours (the "skip all" button)? */
export function areToursDisabled() {
  try {
    return localStorage.getItem(DISABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function disableAllTours() {
  try {
    localStorage.setItem(DISABLED_KEY, "1");
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

export function enableAllTours() {
  try {
    localStorage.removeItem(DISABLED_KEY);
  } catch {
    // ignore
  }
}

export function getDoneSteps() {
  try {
    const raw = localStorage.getItem(STEPS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function isStepDone(id) {
  return getDoneSteps().has(id);
}

export function markStepDone(id) {
  try {
    const done = getDoneSteps();
    done.add(id);
    localStorage.setItem(STEPS_KEY, JSON.stringify([...done]));
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

/** Steps from a tour that the user hasn't completed yet. */
export function remainingSteps(steps = []) {
  const done = getDoneSteps();
  return steps.filter((s) => !done.has(s.id));
}

/** Clear all tour progress (handy for testing / a "replay tours" action). */
export function resetTours() {
  try {
    localStorage.removeItem(STEPS_KEY);
    localStorage.removeItem(DISABLED_KEY);
  } catch {
    // ignore
  }
}

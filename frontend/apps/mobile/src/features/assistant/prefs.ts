import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "fl_assistant_prefs";

export interface AssistantPrefs {
  /** Completely hidden by the user (via Settings). */
  hidden: boolean;
  /** Epoch ms until which the buddy stays snoozed, or null when active. */
  snoozeUntil: number | null;
  /** Persisted floating position (top-left offset in px), or null for the default spot. */
  position: { x: number; y: number } | null;
  /** True once the stored prefs have been read from disk. */
  loaded: boolean;
}

const DEFAULTS: AssistantPrefs = {
  hidden: false,
  snoozeUntil: null,
  position: null,
  loaded: false,
};

let state: AssistantPrefs = DEFAULTS;
const listeners = new Set<() => void>();
let snoozeTimer: ReturnType<typeof setTimeout> | null = null;

const emit = () => listeners.forEach((l) => l());

function persist() {
  const { hidden, snoozeUntil, position } = state;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ hidden, snoozeUntil, position })).catch(
    () => {}
  );
}

/** Clear an expired snooze immediately, or schedule it to clear when it lapses. */
function scheduleSnoozeExpiry() {
  if (snoozeTimer) {
    clearTimeout(snoozeTimer);
    snoozeTimer = null;
  }
  const until = state.snoozeUntil;
  if (until == null) return;
  const remaining = until - Date.now();
  if (remaining <= 0) {
    state = { ...state, snoozeUntil: null };
    return;
  }
  snoozeTimer = setTimeout(() => {
    snoozeTimer = null;
    state = { ...state, snoozeUntil: null };
    persist();
    emit();
  }, remaining);
}

// Eagerly hydrate from storage so the buddy restores its spot on launch.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AssistantPrefs>;
        state = { ...state, ...parsed };
      } catch {
        // Ignore malformed storage and fall back to defaults.
      }
    }
    state = { ...state, loaded: true };
    scheduleSnoozeExpiry();
    emit();
  })
  .catch(() => {
    state = { ...state, loaded: true };
    emit();
  });

export const assistantPrefs = {
  get: () => state,
  set(patch: Partial<Omit<AssistantPrefs, "loaded">>) {
    state = { ...state, ...patch };
    if ("snoozeUntil" in patch) scheduleSnoozeExpiry();
    persist();
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** True while the buddy should stay tucked away (hidden or actively snoozed). */
export function isDismissed(p: AssistantPrefs): boolean {
  return p.hidden || (p.snoozeUntil != null && Date.now() < p.snoozeUntil);
}

export function useAssistantPrefs(): AssistantPrefs {
  return useSyncExternalStore(assistantPrefs.subscribe, assistantPrefs.get, assistantPrefs.get);
}

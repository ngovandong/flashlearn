import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Remembers whether the user manually collapsed a note panel.
 *
 * Without this, a panel would spring back open on every revisit of a lesson the
 * user has already read their note on. Only an explicit toggle is recorded —
 * until then the panel follows the default (open when a note exists).
 */

const KEY = "flashlearn_note_collapsed_v1";

async function read(): Promise<Record<string, boolean>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || "{}");
  } catch {
    return {};
  }
}

/** `true`/`false` if the user has chosen for this target, otherwise `null`. */
export async function readNoteCollapsed(targetType: string, targetKey: string): Promise<boolean | null> {
  const value = (await read())[`${targetType}:${targetKey}`];
  return typeof value === "boolean" ? value : null;
}

export async function writeNoteCollapsed(
  targetType: string,
  targetKey: string,
  collapsed: boolean
): Promise<void> {
  try {
    const all = await read();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...all, [`${targetType}:${targetKey}`]: collapsed }));
  } catch {
    // ignore storage failures
  }
}

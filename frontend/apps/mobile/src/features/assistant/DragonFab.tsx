import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/authSlice";
import { ASSISTANT_NAME } from "@/features/assistant/constants";
import { DragonAvatar } from "@/features/assistant/DragonAvatar";
import { ChatPanel } from "@/features/assistant/ChatPanel";
import { assistantPrefs, isDismissed, useAssistantPrefs } from "@/features/assistant/prefs";

const FAB_SIZE = 64;
const MARGIN = 16;
/** Clearance above the floating tab bar for the default resting spot. */
const TAB_BAR_CLEARANCE = 72;
/** Movement (px) before a press becomes a drag rather than a tap. */
const DRAG_THRESHOLD = 6;
const LONG_PRESS_MS = 380;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const HOUR = 60 * 60 * 1000;

interface SnoozeOption {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  at: () => number;
}

const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: "For 1 hour", icon: "snooze", at: () => Date.now() + HOUR },
  { label: "For 8 hours", icon: "bedtime", at: () => Date.now() + 8 * HOUR },
  {
    label: "Until tomorrow",
    icon: "wb-twilight",
    at: () => {
      const d = new Date();
      d.setHours(24, 0, 0, 0);
      return d.getTime();
    },
  },
];

/**
 * Floating Dragon launcher, mirroring the web assistant. Mounted once in the
 * tab layout so it hovers above every authenticated screen. Tap opens the chat
 * panel; drag repositions it (snapping to the nearest edge); long-press reveals
 * options to snooze it for a while or hide it. It can also be hidden entirely
 * from Settings. Position, snooze and hide state persist across launches.
 */
export function DragonFab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const user = useAppSelector(selectUser);
  const prefs = useAssistantPrefs();

  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const bounds = {
    width,
    minX: MARGIN,
    maxX: width - FAB_SIZE - MARGIN,
    minY: insets.top + MARGIN,
    maxY: height - FAB_SIZE - MARGIN - insets.bottom,
  };
  const defaultPos = {
    x: bounds.maxX,
    y: bounds.maxY - TAB_BAR_CLEARANCE,
  };

  // Latest bounds/default for use inside the (once-created) PanResponder.
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const posRef = useRef(defaultPos);
  const pan = useRef(new Animated.ValueXY(defaultPos)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const movedRef = useRef(false);
  const longPressFiredRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync the animated position with stored prefs: restore a saved spot after
  // hydration, and glide back to the default when the user resets it.
  useEffect(() => {
    if (!prefs.loaded) return;
    const b = boundsRef.current;
    const target = prefs.position
      ? {
          x: clamp(prefs.position.x, b.minX, b.maxX),
          y: clamp(prefs.position.y, b.minY, b.maxY),
        }
      : { x: b.maxX, y: b.maxY - TAB_BAR_CLEARANCE };
    posRef.current = target;
    Animated.spring(pan, {
      toValue: target,
      useNativeDriver: false,
      speed: 20,
      bounciness: 8,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.loaded, prefs.position]);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > DRAG_THRESHOLD || Math.abs(g.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        movedRef.current = false;
        longPressFiredRef.current = false;
        Animated.spring(scale, { toValue: 1.08, useNativeDriver: false, speed: 40, bounciness: 6 }).start();
        clearLongPress();
        longPressTimer.current = setTimeout(() => {
          if (!movedRef.current) {
            longPressFiredRef.current = true;
            Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 40, bounciness: 6 }).start();
            setMenuOpen(true);
          }
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (_e, g) => {
        if (Math.abs(g.dx) > DRAG_THRESHOLD || Math.abs(g.dy) > DRAG_THRESHOLD) {
          movedRef.current = true;
          clearLongPress();
        }
        if (!movedRef.current) return;
        const b = boundsRef.current;
        const next = {
          x: clamp(posRef.current.x + g.dx, b.minX, b.maxX),
          y: clamp(posRef.current.y + g.dy, b.minY, b.maxY),
        };
        pan.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        clearLongPress();
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 40, bounciness: 6 }).start();

        if (movedRef.current) {
          const b = boundsRef.current;
          const rawX = clamp(posRef.current.x + g.dx, b.minX, b.maxX);
          const rawY = clamp(posRef.current.y + g.dy, b.minY, b.maxY);
          // Snap horizontally to the nearest edge; keep the chosen height.
          const snappedX = rawX + FAB_SIZE / 2 >= b.width / 2 ? b.maxX : b.minX;
          const next = { x: snappedX, y: rawY };
          posRef.current = next;
          Animated.spring(pan, {
            toValue: next,
            useNativeDriver: false,
            speed: 18,
            bounciness: 8,
          }).start();
          assistantPrefs.set({ position: next });
        } else if (!longPressFiredRef.current) {
          setOpen(true);
        }
        movedRef.current = false;
      },
      onPanResponderTerminate: () => {
        clearLongPress();
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 40, bounciness: 6 }).start();
      },
    })
  ).current;

  useEffect(() => () => clearLongPress(), []);

  // Signed-in only, and only once prefs are known and not dismissed.
  if (!user || !prefs.loaded || isDismissed(prefs)) return null;

  const applySnooze = (option: SnoozeOption) => {
    assistantPrefs.set({ snoozeUntil: option.at() });
    setMenuOpen(false);
  };

  return (
    <>
      <Animated.View
        {...responder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={`${ASSISTANT_NAME} assistant. Tap to chat, drag to move, long-press for options.`}
        style={[
          styles.fab,
          {
            backgroundColor: theme.colors.surface,
            shadowColor: theme.colors.shadow ?? "#000",
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale },
            ],
          },
        ]}
      >
        <DragonAvatar size={56} idleAnimation />
      </Animated.View>

      {/* Snooze / hide options */}
      <Modal
        visible={menuOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setMenuOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable
            style={[
              styles.menuCard,
              {
                backgroundColor: theme.colors.surface,
                marginBottom: insets.bottom + 24,
              },
            ]}
          >
            <Text
              variant="labelLarge"
              style={[styles.menuTitle, { color: theme.colors.onSurfaceVariant }]}
            >
              Snooze {ASSISTANT_NAME}
            </Text>
            {SNOOZE_OPTIONS.map((option) => (
              <Pressable
                key={option.label}
                onPress={() => applySnooze(option)}
                android_ripple={{ color: theme.colors.surfaceVariant }}
                style={({ pressed }) => [
                  styles.menuRow,
                  pressed && { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <MaterialIcons name={option.icon} size={22} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.onSurface, fontWeight: "600" }}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
            <Divider style={{ marginVertical: 4 }} />
            <Pressable
              onPress={() => {
                assistantPrefs.set({ hidden: true });
                setMenuOpen(false);
              }}
              android_ripple={{ color: theme.colors.surfaceVariant }}
              style={({ pressed }) => [
                styles.menuRow,
                pressed && { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialIcons name="visibility-off" size={22} color={theme.colors.onSurfaceVariant} />
              <View style={styles.flex}>
                <Text style={{ color: theme.colors.onSurface, fontWeight: "600" }}>
                  Hide completely
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Turn back on in Settings
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Chat panel */}
      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropFill} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: insets.bottom,
                height: "88%",
              },
            ]}
          >
            <ChatPanel onClose={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fab: {
    position: "absolute",
    top: 0,
    left: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(224, 33, 138, 0.25)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  menuCard: {
    width: "88%",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  menuTitle: {
    letterSpacing: 0.4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  backdropFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
});

import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { motion, useTokens } from "@/theme/tokens";

const AnimatedIcon = Animated.createAnimatedComponent(MaterialIcons);

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

const BAR_RADIUS = 30;

/** The primary destinations shown in the floating bar, in display order. */
const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: "index", label: "Home", icon: "home-filled" },
  { name: "library", label: "Library", icon: "style" },
  { name: "practice", label: "Practice", icon: "school" },
  { name: "settings", label: "Settings", icon: "settings" },
];

/**
 * A floating, pill-shaped tab bar inspired by Apple's Photos / Music apps.
 * It hovers over content on a frosted "Liquid Glass" pane, with the active
 * destination lifted into a soft tinted chip.
 */
export function FloatingTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const t = useTokens();
  const glass = t.glass.enabled;
  const activeName = state.routes[state.index]?.name;

  const surface = glass ? "transparent" : t.alpha(t.neutral.surface, 0.82);
  const border = glass ? t.glass.border : t.neutral.border;
  // A lighter frost than the shared glass overlay so more of the content
  // shows through the floating bar.
  const overlay =
    t.mode === "dark" ? "rgba(26, 30, 40, 0.28)" : "rgba(255, 255, 255, 0.2)";

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingBottom: insets.bottom + 10 }]}
    >
      <View
        style={[
          styles.bar,
          t.shadowStrong,
          {
            backgroundColor: surface,
            borderColor: border,
          },
        ]}
      >
        <View style={[styles.clip, { borderRadius: BAR_RADIUS }]}>
          {glass ? (
            <>
              <BlurView
                intensity={t.glass.intensity + 15}
                tint={t.glass.tint}
                style={StyleSheet.absoluteFill}
              />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
            </>
          ) : null}

          <View style={styles.row}>
            {TABS.map((tab) => {
              const route = state.routes.find((r) => r.name === tab.name);
              if (!route) return null;
              const focused = activeName === tab.name;

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params as object);
                }
              };

              return (
                <TabButton
                  key={tab.name}
                  focused={focused}
                  label={tab.label}
                  icon={tab.icon}
                  onPress={onPress}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

interface TabButtonProps {
  focused: boolean;
  label: string;
  icon: IconName;
  onPress: () => void;
}

function TabButton({ focused, label, icon, onPress }: TabButtonProps) {
  const t = useTokens();
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(active, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      ...motion.spring.gentle,
    }).start();
  }, [focused, active]);

  const color = focused ? t.palette.primary : t.neutral.textMuted;
  const chipScale = active.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  // A gentle lift + pop on the icon so the active destination feels tactile.
  const iconScale = active.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.16, 1.08] });
  const iconLift = active.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tab}
      android_ripple={{ color: t.primaryAlpha(0.12), borderless: true, radius: 44 }}
    >
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: t.primaryAlpha(0.14),
            opacity: active,
            transform: [{ scale: chipScale }],
          },
        ]}
      />
      <AnimatedIcon
        name={icon}
        size={24}
        color={color}
        style={{ transform: [{ scale: iconScale }, { translateY: iconLift }] }}
      />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  bar: {
    width: "100%",
    borderRadius: BAR_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({ android: { elevation: 14 }, default: {} }),
  },
  clip: {
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
  },
  chip: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: "50%",
    marginLeft: -34,
    width: 68,
    borderRadius: 999,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

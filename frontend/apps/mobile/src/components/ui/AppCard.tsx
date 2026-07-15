import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/PressableScale";
import { useTokens } from "@/theme/tokens";

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Inner padding. Defaults to 16. */
  padding?: number;
  /** Drop the soft shadow (e.g. for nested surfaces). */
  flat?: boolean;
}

/** Elegant elevated surface card — the base container for the mobile UI. */
export function AppCard({ children, onPress, style, padding = 16, flat = false }: Props) {
  const t = useTokens();
  const { glass } = t;
  const radius = glass.enabled ? glass.radius : t.radii.lg;

  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: glass.enabled ? "transparent" : t.neutral.surface,
      borderColor: glass.enabled ? glass.border : t.neutral.border,
      borderWidth: glass.enabled ? 1 : StyleSheet.hairlineWidth,
      borderRadius: radius,
      padding,
      overflow: "hidden" as const,
    },
    flat ? null : glass.enabled ? t.shadowStrong : t.shadow,
    style,
  ];

  // Liquid Glass: a very transparent frosted blur pane + a whisper of overlay
  // tint + a bright top sheen, all clipped to the card's rounded corners.
  const glassLayers = glass.enabled ? (
    <>
      <BlurView
        intensity={glass.intensity}
        tint={glass.tint}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: glass.overlay, borderRadius: radius },
        ]}
      />
      <LinearGradient
        colors={glass.sheen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
    </>
  ) : null;

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={cardStyle}>
        {glassLayers}
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={cardStyle}>
      {glassLayers}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
});

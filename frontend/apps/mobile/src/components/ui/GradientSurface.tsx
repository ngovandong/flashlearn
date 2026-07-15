import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTokens } from "@/theme/tokens";

interface Props {
  children?: React.ReactNode;
  /** Override the palette gradient. */
  colors?: [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  /** Diagonal by default (top-left → bottom-right). */
  angle?: "diagonal" | "horizontal" | "vertical";
}

const ENDS = {
  diagonal: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  horizontal: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  vertical: { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
} as const;

/** Rounded gradient surface using the active palette's gradient tokens. */
export function GradientSurface({ children, colors, style, angle = "diagonal" }: Props) {
  const t = useTokens();
  const ends = ENDS[angle];
  return (
    <LinearGradient
      colors={colors ?? t.gradient}
      start={ends.start}
      end={ends.end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

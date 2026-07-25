import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import Svg, { Circle } from "react-native-svg";
import { motion, useTokens } from "@/theme/tokens";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** 0–100 progress percentage. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Optional override for the progress arc color (defaults to palette primary). */
  color?: string;
  /** Center label. Defaults to the rounded percentage. */
  label?: string;
}

/** Circular progress ring mirroring the web `CircularProgressWithLabel`. */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  color,
  label,
}: Props) {
  const t = useTokens();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const arc = color ?? t.palette.primary;

  // Sweep the arc toward the target offset whenever the value changes.
  const anim = useRef(new Animated.Value(circumference)).current;
  useEffect(() => {
    const a = Animated.timing(anim, {
      toValue: offset,
      duration: motion.duration.slow,
      easing: motion.easing.emphasized,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [anim, offset]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={t.neutral.surface2}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={arc}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={anim}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
          {label ?? `${pct}%`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});

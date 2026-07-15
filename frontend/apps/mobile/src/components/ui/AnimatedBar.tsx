import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { motion } from "@/theme/tokens";

interface Props {
  /** 0–1 completion ratio. */
  progress: number;
  color: string;
  trackColor: string;
  height?: number;
  /** Minimum visible fill percentage so a sliver always shows some progress. */
  minPercent?: number;
  style?: ViewStyle;
}

/**
 * Thin progress bar whose fill width eases toward `progress` whenever it
 * changes. Width can't use the native driver, but a single hairline bar is
 * cheap to animate on the JS thread.
 */
export function AnimatedBar({
  progress,
  color,
  trackColor,
  height = 6,
  minPercent = 3,
  style,
}: Props) {
  const pct = Math.max(minPercent, Math.min(100, progress * 100));
  const anim = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    const a = Animated.timing(anim, {
      toValue: pct,
      duration: motion.duration.slow,
      easing: motion.easing.emphasized,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [anim, pct]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }, style]}>
      <Animated.View style={{ width, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: "hidden" },
});

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTokens } from "@/theme/tokens";

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * A shimmering placeholder block. A soft highlight band sweeps across a muted
 * base surface on a loop — the standard "content is loading" affordance. Built
 * on the RN Animated API (native driver) so the sweep stays at 60fps.
 */
export function Skeleton({ width = "100%", height = 16, radius = 10, style }: Props) {
  const t = useTokens();
  const [boxWidth, setBoxWidth] = useState(0);
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const onLayout = (e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-boxWidth, boxWidth],
  });

  // Highlight tint that reads on both light and dark muted surfaces.
  const highlight =
    t.mode === "dark" ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.65)";

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: t.neutral.surface2,
          overflow: "hidden",
        },
        style as ViewStyle,
      ]}
    >
      {boxWidth > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={["transparent", highlight, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

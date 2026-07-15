import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  message?: string;
}

const DOT_COUNT = 3;

/** A single dot that bounces up and fades on a staggered loop. */
function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 360,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color, opacity, transform: [{ translateY }, { scale }] }]}
    />
  );
}

export function LoadingView({ message }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.center}>
      <View style={styles.dots}>
        {Array.from({ length: DOT_COUNT }).map((_, i) => (
          <Dot key={i} delay={i * 140} color={theme.colors.primary} />
        ))}
      </View>
      {message ? (
        <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  dots: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 20 },
  dot: { width: 11, height: 11, borderRadius: 6 },
});

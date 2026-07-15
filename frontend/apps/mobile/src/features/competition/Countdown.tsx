import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  onDone: () => void;
}

// "3 · 2 · 1 · GO!" arcade intro using the built-in Animated API.
export function Countdown({ onDone }: Props) {
  const theme = useTheme();
  const [step, setStep] = useState(3);
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step < 0) {
      onDone();
      return;
    }
    scale.setValue(0.3);
    Animated.timing(scale, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: true,
    }).start();
    const id = setTimeout(() => setStep((s) => s - 1), step === 0 ? 550 : 700);
    return () => clearTimeout(id);
  }, [step, onDone, scale]);

  if (step < 0) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.Text
        style={[
          styles.num,
          {
            color: step === 0 ? theme.colors.tertiary ?? theme.colors.primary : theme.colors.primary,
            transform: [{ scale }],
          },
        ]}
      >
        {step === 0 ? "GO!" : step}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    zIndex: 10,
  },
  num: { fontSize: 80, fontWeight: "900" },
});

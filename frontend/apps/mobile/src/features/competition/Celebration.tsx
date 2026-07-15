import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet } from "react-native";

const EMOJIS = ["🎉", "⭐", "🎊", "✨", "🏆", "🎈"];
const COUNT = 14;
const { width, height } = Dimensions.get("window");

// A lightweight confetti burst using the built-in Animated API (no extra deps).
export function Celebration() {
  const pieces = useRef(
    Array.from({ length: COUNT }, (_, i) => ({
      anim: new Animated.Value(0),
      x: Math.random() * width,
      emoji: EMOJIS[i % EMOJIS.length],
      delay: Math.random() * 250,
      drift: (Math.random() - 0.5) * 80,
    }))
  ).current;

  useEffect(() => {
    Animated.stagger(
      40,
      pieces.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 1400,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [pieces]);

  return (
    <>
      {pieces.map((p, i) => (
        <Animated.Text
          key={i}
          pointerEvents="none"
          style={[
            styles.piece,
            {
              left: p.x,
              transform: [
                {
                  translateY: p.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-40, height * 0.7],
                  }),
                },
                {
                  translateX: p.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, p.drift],
                  }),
                },
                {
                  rotate: p.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
              opacity: p.anim.interpolate({
                inputRange: [0, 0.8, 1],
                outputRange: [1, 1, 0],
              }),
            },
          ]}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute", top: 0, fontSize: 24 },
});

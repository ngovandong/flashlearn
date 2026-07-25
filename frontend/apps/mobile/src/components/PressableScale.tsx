import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { motion } from "@/theme/tokens";

interface Props extends Omit<PressableProps, "style"> {
  children: React.ReactNode;
  /** Scale applied while pressed. */
  activeScale?: number;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable that gently scales down on touch for tactile feedback. Uses the RN
 * Animated API (native driver) so it works without Reanimated.
 *
 * The style is applied directly to the Pressable so that layout constraints
 * (e.g. `flex: 1`, widths) affect the real flex child — otherwise a wrapper
 * view would size to its content and break row layouts.
 */
export function PressableScale({
  children,
  activeScale = 0.97,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      ...motion.spring.press,
    }).start();
  };

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        animateTo(activeScale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

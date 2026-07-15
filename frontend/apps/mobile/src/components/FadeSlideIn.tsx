import React, { useEffect, useRef } from "react";
import { Animated, type ViewStyle } from "react-native";
import { motion } from "@/theme/tokens";

interface Props {
  children: React.ReactNode;
  /** Delay before the entrance starts, in ms. Use to stagger lists. */
  delay?: number;
  /** Distance in px the content travels upward while fading in. */
  offset?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Lightweight mount entrance (fade + slide up) built on the RN Animated API so
 * it works without the Reanimated Babel plugin. Native-driven for 60fps.
 */
export function FadeSlideIn({
  children,
  delay = 0,
  offset = 12,
  duration = motion.duration.normal,
  style,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: motion.easing.entrance,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, duration]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { PressableScale } from "@/components/PressableScale";
import { motion, useTokens } from "@/theme/tokens";

export interface PillOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: PillOption<T>[];
  onChange: (value: T) => void;
}

const WRAP_PADDING = 4;
const GAP = 4;

/** Rounded segmented pill control with a sliding indicator that tracks the active tab. */
export function PillTabs<T extends string>({ value, options, onChange }: Props<T>) {
  const t = useTokens();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const count = options.length;

  const innerWidth = Math.max(0, width - WRAP_PADDING * 2);
  const pillWidth = count ? (innerWidth - GAP * (count - 1)) / count : 0;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pillWidth) return;
    Animated.spring(translateX, {
      toValue: index * (pillWidth + GAP),
      useNativeDriver: true,
      ...motion.spring.gentle,
    }).start();
  }, [index, pillWidth, translateX]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[styles.wrap, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
    >
      {pillWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            t.shadow,
            {
              width: pillWidth,
              borderRadius: t.radii.pill,
              backgroundColor: t.neutral.surface,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.pill, { borderRadius: t.radii.pill }]}
          >
            <Text
              style={{
                color: active ? t.palette.primary : t.neutral.textMinor,
                fontWeight: active ? "800" : "600",
                textAlign: "center",
              }}
            >
              {opt.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", padding: WRAP_PADDING, gap: GAP },
  pill: { flex: 1, paddingVertical: 9, paddingHorizontal: 8, alignItems: "center" },
  indicator: {
    position: "absolute",
    top: WRAP_PADDING,
    bottom: WRAP_PADDING,
    left: WRAP_PADDING,
  },
});

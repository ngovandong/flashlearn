import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTokens } from "@/theme/tokens";

interface Props {
  /** MaterialIcons glyph name (also used to resolve the accent color). */
  icon: string;
  size?: number;
  /** "soft" = tinted background + colored icon; "solid" = filled accent tile. */
  variant?: "soft" | "solid";
  style?: StyleProp<ViewStyle>;
}

/** Colorful rounded icon tile — the signature accent of the web + mobile UI. */
export function FeatureTile({ icon, size = 46, variant = "soft", style }: Props) {
  const t = useTokens();
  const { fg, tint } = t.feature(icon);
  const solid = variant === "solid";
  const iconSize = Math.round(size * 0.5);

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: solid ? fg : tint,
        },
        style,
      ]}
    >
      <MaterialIcons name={icon as any} size={iconSize} color={solid ? "#ffffff" : fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center" },
});

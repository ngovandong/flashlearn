import React from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { PressableScale } from "@/components/PressableScale";
import { GradientSurface } from "@/components/ui/GradientSurface";
import { useTokens } from "@/theme/tokens";

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

/** Full-width gradient CTA matching the web app's primary button. */
export function GradientButton({ label, onPress, loading, disabled, icon, style }: Props) {
  const t = useTokens();
  const inactive = disabled || loading;

  const inner = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <>
          {icon ? <MaterialIcons name={icon as any} size={20} color="#ffffff" /> : null}
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </View>
  );

  if (inactive) {
    return (
      <View
        style={[
          styles.base,
          { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill },
          style,
        ]}
      >
        <View style={styles.inner}>
          {loading ? (
            <ActivityIndicator color={t.neutral.textMinor} size="small" />
          ) : (
            <Text style={[styles.label, { color: t.neutral.textMuted }]}>{label}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.base, { borderRadius: t.radii.pill }, t.shadow, style]}
    >
      <GradientSurface style={[styles.fill, { borderRadius: t.radii.pill }]}>
        {inner}
      </GradientSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden" },
  fill: { alignItems: "center", justifyContent: "center" },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    paddingHorizontal: 20,
  },
  label: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
});

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { AnimatedBar } from "@/components/ui/AnimatedBar";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { useTokens } from "@/theme/tokens";

interface Props {
  /** MaterialIcons glyph key (also resolves the accent color). */
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Optional 0–1 completion ratio rendered as a thin progress bar. */
  progress?: number;
  /** Trailing accessory. Defaults to a chevron; pass a glyph name to override. */
  rightIcon?: string;
  rightIconColor?: string;
  /** Fully custom trailing node (overrides rightIcon). */
  trailing?: React.ReactNode;
  disabled?: boolean;
  tileVariant?: "soft" | "solid";
}

/** Standard tappable navigation row card — icon tile + title/subtitle + accessory. */
export function NavCard({
  icon,
  title,
  subtitle,
  onPress,
  progress,
  rightIcon = "chevron-right",
  rightIconColor,
  trailing,
  disabled = false,
  tileVariant = "soft",
}: Props) {
  const t = useTokens();
  const pct = progress != null ? Math.max(0, Math.min(1, progress)) : null;

  return (
    <AppCard onPress={disabled ? undefined : onPress} padding={14} style={disabled ? styles.disabled : undefined}>
      <View style={styles.row}>
        <FeatureTile icon={icon} size={44} variant={tileVariant} />
        <View style={styles.body}>
          <Text variant="titleMedium" numberOfLines={2} style={{ color: t.neutral.text, fontWeight: "700" }}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
          {pct != null ? (
            <AnimatedBar
              progress={pct}
              color={t.palette.primary}
              trackColor={t.neutral.surface2}
              style={styles.track}
            />
          ) : null}
        </View>
        {trailing ?? (
          <MaterialIcons name={rightIcon as any} size={22} color={rightIconColor ?? t.neutral.textMuted} />
        )}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.55 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  body: { flex: 1 },
  track: { marginTop: 8 },
});

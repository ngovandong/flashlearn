import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTokens } from "@/theme/tokens";

interface Props {
  /** Number of placeholder card rows. */
  rows?: number;
  /** Show a segmented-control placeholder under the title. */
  showTabs?: boolean;
}

/** Placeholder for a single icon-tile + title/subtitle card row. */
function CardRowSkeleton() {
  const t = useTokens();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.neutral.surface,
          borderColor: t.neutral.border,
          borderRadius: t.radii.lg,
        },
        t.shadow,
      ]}
    >
      <Skeleton width={44} height={44} radius={14} />
      <View style={styles.body}>
        <Skeleton width="62%" height={15} />
        <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
        <Skeleton width="100%" height={6} radius={3} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

/**
 * Full-screen loading state that mirrors a header + list-of-cards layout, so the
 * transition to real content feels seamless instead of a jarring spinner swap.
 */
export function ScreenSkeleton({ rows = 5, showTabs = false }: Props) {
  const t = useTokens();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Skeleton width={120} height={13} />
        <Skeleton width="55%" height={30} radius={12} style={{ marginTop: 8 }} />
        {showTabs ? (
          <Skeleton width="100%" height={44} radius={t.radii.pill} style={{ marginTop: 16 }} />
        ) : null}
      </View>
      <View style={styles.list}>
        {Array.from({ length: rows }).map((_, i) => (
          <CardRowSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 18 },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1 },
});

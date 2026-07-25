import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { resolveImageUrl, type Deck } from "@flashlearn/core";
import { AppCard } from "@/components/ui/AppCard";
import { AnimatedBar } from "@/components/ui/AnimatedBar";
import { useTokens } from "@/theme/tokens";

interface Props {
  deck: Deck;
  onPress: () => void;
}

export function DeckCard({ deck, onPress }: Props) {
  const t = useTokens();
  const learned = deck.learned ?? 0;
  const total = deck.number_of_term ?? 0;
  const ratio = total ? learned / total : 0;
  const pct = Math.round(ratio * 100);
  const imageUrl = resolveImageUrl(deck.background);
  const { fg, tint } = t.feature("style");

  return (
    <AppCard onPress={onPress} padding={12}>
      <View style={styles.row}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.icon} resizeMode="cover" />
        ) : (
          <View style={[styles.icon, styles.iconPlaceholder, { backgroundColor: tint }]}>
            <MaterialIcons name="style" size={24} color={fg} />
          </View>
        )}
        <View style={styles.body}>
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={{ color: t.neutral.text, fontWeight: "700" }}
          >
            {deck.name}
          </Text>
          <Text variant="bodySmall" style={{ color: t.neutral.textMinor }}>
            {total} terms · {pct}% learned
          </Text>
          {total > 0 ? (
            <AnimatedBar
              progress={ratio}
              color={t.palette.primary}
              trackColor={t.neutral.surface2}
              style={styles.track}
            />
          ) : null}
        </View>
        <MaterialIcons name="chevron-right" size={22} color={t.neutral.textMuted} />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 14 },
  iconPlaceholder: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 3 },
  track: { marginTop: 6 },
});

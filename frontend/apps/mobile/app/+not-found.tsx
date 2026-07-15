import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Stack, useRouter } from "expo-router";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { useTokens } from "@/theme/tokens";

export default function NotFoundScreen() {
  const t = useTokens();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={[styles.container, { backgroundColor: t.neutral.bg }]}>
        <FadeSlideIn>
          <View style={styles.inner}>
            <FeatureTile icon="auto-awesome" size={72} variant="solid" />
            <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 18 }}>
              Page not found
            </Text>
            <Text variant="bodyMedium" style={[styles.subtitle, { color: t.neutral.textMinor }]}>
              This screen doesn't exist or has moved.
            </Text>
            <GradientButton label="Go home" icon="home" onPress={() => router.replace("/")} style={styles.button} />
          </View>
        </FadeSlideIn>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  inner: { alignItems: "center" },
  subtitle: { textAlign: "center", marginTop: 8 },
  button: { marginTop: 20, minWidth: 200 },
});

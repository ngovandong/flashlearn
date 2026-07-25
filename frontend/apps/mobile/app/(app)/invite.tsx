import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { roleApi } from "@/api/services";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const t = useTokens();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing invite token.");
      return;
    }
    roleApi
      .invite(token)
      .then((res) => {
        const data = unwrap<{ deck_id?: string; message?: string }>(res);
        setStatus("ok");
        setMessage(data.message ?? "You joined the deck!");
        if (data.deck_id) {
          setTimeout(() => router.replace(`/library/${data.deck_id}`), 1500);
        }
      })
      .catch((e: Error) => {
        setStatus("error");
        setMessage(e.message);
      });
  }, [token, router]);

  if (status === "loading") return <LoadingView message="Accepting invite…" />;

  return (
    <View style={[styles.center, { backgroundColor: t.neutral.bg }]}>
      <FadeSlideIn>
        <View style={styles.inner}>
          <FeatureTile icon={status === "ok" ? "emoji-events" : "spellcheck"} size={72} variant="solid" />
          <Text
            variant="titleLarge"
            style={{ color: status === "ok" ? t.neutral.text : "#ef4444", textAlign: "center", fontWeight: "800", marginTop: 18 }}
          >
            {message}
          </Text>
          <GradientButton label="Go to library" onPress={() => router.replace("/library")} style={styles.btn} />
        </View>
      </FadeSlideIn>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  inner: { alignItems: "center" },
  btn: { marginTop: 24, alignSelf: "stretch", minWidth: 220 },
});

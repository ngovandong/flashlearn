import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { roleApi } from "@/api/services";
import { LoadingView } from "@/components/LoadingView";
import { unwrap } from "@/utils/apiError";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const theme = useTheme();
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
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleLarge" style={{ color: status === "ok" ? theme.colors.primary : theme.colors.error, textAlign: "center" }}>
        {message}
      </Text>
      <Button mode="contained" onPress={() => router.replace("/library")} style={{ marginTop: 24 }}>
        Go to library
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});

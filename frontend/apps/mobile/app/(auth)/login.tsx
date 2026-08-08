import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Text, TextInput, HelperText } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getFirstError } from "@flashlearn/core";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  login,
  selectError,
  selectLoading,
  setToken,
  setError,
} from "@/store/authSlice";
import { useGoogleSignIn } from "@/auth/googleAuth";
import { nativeAuthApi } from "@/auth/nativeAuthApi";
import { Sentry } from "@/config/sentry";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { useTokens } from "@/theme/tokens";

export default function LoginScreen() {
  const t = useTokens();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const error = useAppSelector(selectError);
  const loading = useAppSelector(selectLoading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn: googleSignIn, ready: googleReady } = useGoogleSignIn();

  const onSubmit = () => {
    if (!email.trim() || !password) return;
    dispatch(login({ email: email.trim(), password }));
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    dispatch(setError(""));
    try {
      const result = await googleSignIn();
      if (result.status === "cancelled") return;
      if (result.status === "error") {
        Sentry.captureMessage(`Google sign-in failed: ${result.message}`);
        dispatch(setError(result.message));
        return;
      }
      const res: any = await nativeAuthApi.initUser(result.idToken);
      if (!res?.error && res?.data) {
        dispatch(setToken(res.data));
      } else {
        const message = getFirstError(res?.error) || "Google login failed.";
        Sentry.captureMessage(`Google init failed: ${message}`, { tags: { authContext: "google-init" } });
        dispatch(setError(message));
      }
    } catch (error) {
      Sentry.captureException(error, { tags: { authContext: "google-login" } });
      dispatch(setError("Google login failed."));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.neutral.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <FadeSlideIn>
            <View style={styles.brand}>
              <FeatureTile icon="school" size={72} variant="solid" />
              <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 16 }}>
                Welcome back
              </Text>
              <Text variant="bodyMedium" style={{ color: t.neutral.textMinor, textAlign: "center", marginTop: 4 }}>
                Sign in to keep learning with FlashLearn.
              </Text>
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={60}>
            <TextInput
              mode="outlined"
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              style={styles.field}
              outlineStyle={{ borderRadius: t.radii.md }}
            />
            <TextInput
              mode="outlined"
              label="Password"
              secureTextEntry={secure}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={onSubmit}
              right={<TextInput.Icon icon={secure ? "eye" : "eye-off"} onPress={() => setSecure((s) => !s)} />}
              style={styles.field}
              outlineStyle={{ borderRadius: t.radii.md }}
            />

            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>

            <GradientButton
              label="Log in"
              loading={loading}
              disabled={loading || !email.trim() || !password}
              onPress={onSubmit}
            />

            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: t.neutral.border }]} />
              <Text style={{ marginHorizontal: 12, color: t.neutral.textMuted }}>or</Text>
              <View style={[styles.divider, { backgroundColor: t.neutral.border }]} />
            </View>

            <PressableScale
              onPress={onGoogle}
              disabled={!googleReady || googleLoading || loading}
              style={[
                styles.googleBtn,
                {
                  borderColor: t.neutral.border,
                  borderRadius: t.radii.pill,
                  opacity: !googleReady || googleLoading || loading ? 0.5 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons name="google" size={20} color={t.neutral.text} />
              <Text style={{ color: t.neutral.text, fontWeight: "700" }}>
                {googleLoading ? "Connecting…" : "Continue with Google"}
              </Text>
            </PressableScale>

            <View style={styles.signupRow}>
              <Text style={{ color: t.neutral.textMinor }}>New to FlashLearn?</Text>
              <PressableScale onPress={() => router.push("/signup")} hitSlop={8}>
                <Text style={{ color: t.palette.primary, fontWeight: "800" }}>Create account</Text>
              </PressableScale>
            </View>
          </FadeSlideIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  brand: { alignItems: "center", marginBottom: 28 },
  field: { marginBottom: 12, backgroundColor: "transparent" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderWidth: 1.5,
  },
  signupRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20 },
});

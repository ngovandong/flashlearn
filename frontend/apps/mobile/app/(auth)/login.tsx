import React, { useEffect, useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import {
  Button,
  Text,
  TextInput,
  HelperText,
  Divider,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFirstError } from "@flashlearn/core";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  login,
  selectError,
  selectLoading,
  setToken,
  setError,
} from "@/store/authSlice";
import { useGoogleAuth, extractIdToken } from "@/auth/googleAuth";
import { nativeAuthApi } from "@/auth/nativeAuthApi";

export default function LoginScreen() {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const error = useAppSelector(selectError);
  const loading = useAppSelector(selectLoading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const { request, promptAsync } = useGoogleAuth();
  const [googleResponse, setGoogleResponse] = useState<Awaited<
    ReturnType<typeof promptAsync>
  > | null>(null);

  useEffect(() => {
    const idToken = extractIdToken(googleResponse);
    if (!idToken) return;
    (async () => {
      const res: any = await nativeAuthApi.initUser(idToken);
      if (!res?.error && res?.data) {
        dispatch(setToken(res.data));
      } else {
        dispatch(setError(getFirstError(res?.error) || "Google login failed."));
      }
    })();
  }, [googleResponse, dispatch]);

  const onSubmit = () => {
    if (!email.trim() || !password) return;
    dispatch(login({ email: email.trim(), password }));
  };

  const onGoogle = async () => {
    const result = await promptAsync();
    setGoogleResponse(result);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text variant="headlineMedium" style={{ color: theme.colors.onBackground }}>
            Welcome back
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 24 }}
          >
            Sign in to keep learning with FlashLearn.
          </Text>

          <TextInput
            mode="outlined"
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            style={styles.field}
          />
          <TextInput
            mode="outlined"
            label="Password"
            secureTextEntry={secure}
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={onSubmit}
            right={
              <TextInput.Icon
                icon={secure ? "eye" : "eye-off"}
                onPress={() => setSecure((s) => !s)}
              />
            }
            style={styles.field}
          />

          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>

          <Button
            mode="contained"
            loading={loading}
            disabled={loading || !email.trim() || !password}
            onPress={onSubmit}
            style={styles.action}
          >
            Log in
          </Button>

          <View style={styles.dividerRow}>
            <Divider style={styles.flex} />
            <Text style={{ marginHorizontal: 12, color: theme.colors.onSurfaceVariant }}>
              or
            </Text>
            <Divider style={styles.flex} />
          </View>

          <Button
            mode="outlined"
            icon="google"
            disabled={!request}
            onPress={onGoogle}
          >
            Continue with Google
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  field: { marginBottom: 12 },
  action: { marginTop: 8, paddingVertical: 4 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
});

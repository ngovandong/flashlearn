import React, { useState } from "react";
import { ScrollView, StyleSheet, View, KeyboardAvoidingView, Platform } from "react-native";
import { Button, HelperText, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getFirstError } from "@flashlearn/core";
import { nativeAuthApi } from "@/auth/nativeAuthApi";

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit =
    firstName.trim() && lastName.trim() && email.trim() && password && confirm;

  const onSubmit = async () => {
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res: any = await nativeAuthApi.signUp({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      });
      if (res?.error) {
        setError(getFirstError(res.error) || "Could not create account.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <View style={styles.doneWrap}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, textAlign: "center" }}>
            Check your inbox
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginTop: 12 }}
          >
            We've sent a verification link to {email.trim()}. Click it to activate your account, then log in.
          </Text>
          <Button mode="contained" onPress={() => router.replace("/login")} style={{ marginTop: 24 }}>
            Back to log in
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text variant="headlineMedium" style={{ color: theme.colors.onBackground }}>
            Create your account
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 24 }}
          >
            Join FlashLearn and start building your streak.
          </Text>

          <TextInput mode="outlined" label="First name" value={firstName} onChangeText={setFirstName} style={styles.field} />
          <TextInput mode="outlined" label="Last name" value={lastName} onChangeText={setLastName} style={styles.field} />
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
            right={<TextInput.Icon icon={secure ? "eye" : "eye-off"} onPress={() => setSecure((s) => !s)} />}
            style={styles.field}
          />
          <TextInput
            mode="outlined"
            label="Confirm password"
            secureTextEntry={secure}
            autoCapitalize="none"
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={onSubmit}
            style={styles.field}
          />

          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>

          <Button
            mode="contained"
            loading={loading}
            disabled={loading || !canSubmit}
            onPress={onSubmit}
            style={styles.action}
          >
            Sign up
          </Button>

          <View style={styles.bottomRow}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>Already have an account?</Text>
            <Button mode="text" compact onPress={() => router.replace("/login")}>
              Log in
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { padding: 24, justifyContent: "center", flexGrow: 1 },
  field: { marginBottom: 12 },
  action: { marginTop: 8, paddingVertical: 4 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12 },
  doneWrap: { flex: 1, justifyContent: "center", padding: 24 },
});

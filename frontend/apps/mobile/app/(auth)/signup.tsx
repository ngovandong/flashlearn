import React, { useState } from "react";
import { ScrollView, StyleSheet, View, KeyboardAvoidingView, Platform } from "react-native";
import { Avatar, HelperText, Text, TextInput } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getFirstError } from "@flashlearn/core";
import { nativeAuthApi } from "@/auth/nativeAuthApi";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { useTokens } from "@/theme/tokens";
import { uploadImageToCloudinary } from "@/utils/cloudinaryUpload";

export default function SignUpScreen() {
  const t = useTokens();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [secure, setSecure] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit =
    firstName.trim() && lastName.trim() && email.trim() && password && confirm;

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library access is needed to pick a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      let imageUrl: string | undefined;
      if (avatarUri) {
        imageUrl = await uploadImageToCloudinary(avatarUri);
      }
      const res: any = await nativeAuthApi.signUp({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        ...(imageUrl ? { image_url: imageUrl } : {}),
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
      <SafeAreaView style={[styles.safe, { backgroundColor: t.neutral.bg }]}>
        <View style={styles.doneWrap}>
          <FeatureTile icon="forum" size={72} variant="solid" />
          <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800", textAlign: "center", marginTop: 16 }}>
            Check your inbox
          </Text>
          <Text variant="bodyMedium" style={{ color: t.neutral.textMinor, textAlign: "center", marginTop: 12 }}>
            We've sent a verification link to {email.trim()}. Click it to activate your account, then log in.
          </Text>
          <GradientButton label="Back to log in" onPress={() => router.replace("/login")} style={{ marginTop: 24, alignSelf: "stretch" }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.neutral.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <FadeSlideIn>
            <View style={styles.brand}>
              <FeatureTile icon="school" size={64} variant="solid" />
              <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 14 }}>
                Create your account
              </Text>
              <Text variant="bodyMedium" style={{ color: t.neutral.textMinor, textAlign: "center", marginTop: 4 }}>
                Join FlashLearn and start building your streak.
              </Text>
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={60}>
            <View style={styles.avatarRow}>
              <PressableScale onPress={pickAvatar} accessibilityLabel="Choose a profile photo">
                {avatarUri ? (
                  <Avatar.Image size={84} source={{ uri: avatarUri }} />
                ) : (
                  <Avatar.Icon
                    size={84}
                    icon="camera-plus-outline"
                    style={{ backgroundColor: t.neutral.surface2 }}
                    color={t.neutral.textMinor}
                  />
                )}
              </PressableScale>
              <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 8 }}>
                {avatarUri ? "Tap to change photo" : "Add a profile photo (optional)"}
              </Text>
            </View>
            <View style={styles.namesRow}>
              <TextInput mode="outlined" label="First name" value={firstName} onChangeText={setFirstName} style={styles.half} outlineStyle={{ borderRadius: t.radii.md }} />
              <TextInput mode="outlined" label="Last name" value={lastName} onChangeText={setLastName} style={styles.half} outlineStyle={{ borderRadius: t.radii.md }} />
            </View>
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
              right={<TextInput.Icon icon={secure ? "eye" : "eye-off"} onPress={() => setSecure((s) => !s)} />}
              style={styles.field}
              outlineStyle={{ borderRadius: t.radii.md }}
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
              outlineStyle={{ borderRadius: t.radii.md }}
            />

            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>

            <GradientButton label="Sign up" loading={loading} disabled={loading || !canSubmit} onPress={onSubmit} />

            <View style={styles.bottomRow}>
              <Text style={{ color: t.neutral.textMinor }}>Already have an account?</Text>
              <PressableScale onPress={() => router.replace("/login")} hitSlop={8}>
                <Text style={{ color: t.palette.primary, fontWeight: "800" }}>Log in</Text>
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
  container: { padding: 24, justifyContent: "center", flexGrow: 1 },
  brand: { alignItems: "center", marginBottom: 24 },
  avatarRow: { alignItems: "center", marginBottom: 20 },
  namesRow: { flexDirection: "row", gap: 12 },
  half: { flex: 1, marginBottom: 12, backgroundColor: "transparent" },
  field: { marginBottom: 12, backgroundColor: "transparent" },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20 },
  doneWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
});

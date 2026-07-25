import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { useRouter, useSegments } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  bootstrapSession,
  getUser,
  selectBootstrapped,
  selectToken,
  selectUser,
} from "@/store/authSlice";
import { useServerThemeSync } from "@/theme/useServerThemeSync";

/**
 * Startup session gate: silently restores the session from the stored refresh
 * token, fetches the profile once a token exists, shows a splash until the
 * bootstrap resolves, and redirects between the (auth) and (app) groups.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const bootstrapped = useAppSelector(selectBootstrapped);
  const token = useAppSelector(selectToken);
  const user = useAppSelector(selectUser);
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();

  useServerThemeSync();

  useEffect(() => {
    dispatch(bootstrapSession());
  }, [dispatch]);

  useEffect(() => {
    if (token && !user) {
      dispatch(getUser());
    }
  }, [token, user, dispatch]);

  useEffect(() => {
    if (!bootstrapped) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!token && !inAuthGroup) {
      router.replace("/login");
    } else if (token && inAuthGroup) {
      router.replace("/");
    }
  }, [bootstrapped, token, segments, router]);

  if (!bootstrapped) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="titleMedium" style={{ marginTop: 16, color: theme.colors.onBackground }}>
          FlashLearn
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

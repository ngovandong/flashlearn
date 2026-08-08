import "react-native-gesture-handler";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider as ReduxProvider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Slot } from "expo-router";
import { store } from "@/store";
import { queryClient } from "@/query/queryClient";
import { AppThemeProvider } from "@/theme/ThemeProvider";
import { AuthGate } from "@/components/AuthGate";
import { initSentry, Sentry } from "@/config/sentry";

initSentry();

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <AppThemeProvider>
              <StatusBar style="auto" />
              <AuthGate>
                <Slot />
              </AuthGate>
            </AppThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

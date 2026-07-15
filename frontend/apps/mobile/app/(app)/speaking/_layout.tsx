import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

export default function SpeakingLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.onSurface },
        headerTintColor: theme.colors.primary,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Speaking coach" }} />
      <Stack.Screen name="[id]" options={{ title: "Conversation" }} />
      <Stack.Screen name="history" options={{ headerShown: false }} />
    </Stack>
  );
}

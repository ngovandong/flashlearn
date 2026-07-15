import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

export default function WritingLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        animation: "slide_from_right",
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.onSurface },
        headerTintColor: theme.colors.primary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Writing coach" }} />
      <Stack.Screen name="[id]" options={{ title: "Session" }} />
    </Stack>
  );
}

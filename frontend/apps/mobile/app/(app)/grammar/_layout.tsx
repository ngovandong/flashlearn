import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

export default function GrammarLayout() {
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
      <Stack.Screen name="index" options={{ title: "Grammar" }} />
      <Stack.Screen name="[unitKey]" options={{ title: "Unit" }} />
    </Stack>
  );
}

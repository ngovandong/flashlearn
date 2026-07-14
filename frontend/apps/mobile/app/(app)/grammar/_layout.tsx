import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

export default function GrammarLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.onSurface },
        headerTintColor: theme.colors.primary,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Grammar" }} />
      <Stack.Screen name="[unitKey]" options={{ title: "Unit" }} />
    </Stack>
  );
}

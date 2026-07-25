import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

export default function ListeningLayout() {
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
      <Stack.Screen name="index" options={{ title: "Listening" }} />
      <Stack.Screen name="numbers" options={{ title: "Number listening" }} />
      <Stack.Screen name="topic/[topicSlug]" options={{ title: "Topic" }} />
      <Stack.Screen name="exercise/[exerciseId]" options={{ title: "Exercise" }} />
    </Stack>
  );
}

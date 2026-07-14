import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

export default function LibraryLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.onSurface },
        headerTintColor: theme.colors.primary,
      }}
    >
      <Stack.Screen name="index" options={{ title: "My decks" }} />
      <Stack.Screen name="create" options={{ title: "Create deck" }} />
      <Stack.Screen name="[deckId]/index" options={{ title: "Deck" }} />
      <Stack.Screen name="[deckId]/edit" options={{ title: "Edit deck" }} />
      <Stack.Screen name="[deckId]/learn/index" options={{ title: "Learn" }} />
      <Stack.Screen name="[deckId]/revise/index" options={{ title: "Revise" }} />
      <Stack.Screen name="[deckId]/revise/quick-revise" options={{ title: "Quick revise" }} />
      <Stack.Screen name="[deckId]/share" options={{ title: "Share deck" }} />
    </Stack>
  );
}

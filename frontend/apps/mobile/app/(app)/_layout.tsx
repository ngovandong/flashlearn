import { View } from "react-native";
import { Tabs } from "expo-router";
import { DragonFab } from "@/features/assistant/DragonFab";
import { FloatingTabBar } from "@/components/ui/FloatingTabBar";
import { useTokens } from "@/theme/tokens";

export default function AppLayout() {
  const t = useTokens();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          animation: "shift",
          headerStyle: { backgroundColor: t.neutral.surface },
          headerTitleStyle: { color: t.neutral.text, fontWeight: "800" },
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", headerShown: false }} />
        <Tabs.Screen name="library" options={{ title: "Library", headerShown: false }} />
        <Tabs.Screen name="practice" options={{ title: "Practice", headerShown: false }} />
        <Tabs.Screen name="settings" options={{ title: "Settings", headerShown: false }} />
        <Tabs.Screen name="courses" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="listening" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="grammar" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="speaking" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="writing" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="revise" options={{ href: null, title: "Mixed revise" }} />
        <Tabs.Screen name="invite" options={{ href: null, title: "Join deck" }} />
      </Tabs>
      <DragonFab />
    </View>
  );
}

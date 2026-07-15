import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";

export default function AppLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: theme.colors.surface },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.onSurface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="style" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: "Practice",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="school" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen name="courses" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="listening" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="grammar" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="speaking" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="writing" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="revise" options={{ href: null }} />
      <Tabs.Screen name="invite" options={{ href: null, title: "Join deck" }} />
    </Tabs>
  );
}

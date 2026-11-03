import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HcSsh } from "../modules/hc-ssh";
import { fleet, startFleet } from "../src/fleet-store";
import { loadSettings } from "../src/settings";
import { startUpdateChecks } from "../src/updates";
import { colors } from "../src/ui/theme";

export default function Layout() {
  useEffect(() => {
    void loadSettings();
    void startFleet();
    try {
      HcSsh.stopWatching();
    } catch {}
    startUpdateChecks();
    const sub = AppState.addEventListener("change", (s) => s === "active" && fleet.probe());
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Spaces" }} />
        <Stack.Screen name="machines" options={{ title: "Machines" }} />
        <Stack.Screen name="session/[key]" options={{ title: "" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </SafeAreaProvider>
  );
}

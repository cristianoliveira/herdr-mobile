import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activityItems } from "../src/activity";
import { fleet, useFleet } from "../src/fleet-store";
import type { Session } from "../src/hc/fleet";
import { spaces as spacesOf } from "../src/spaces";
import { ActivityList } from "../src/ui/ActivityList";
import { colors, space } from "../src/ui/theme";

export default function Activity() {
  const { sessions, docs } = useFleet();
  const insets = useSafeAreaInsets();
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(timer);
  }, []);
  const targets = fleet.targets();
  const { spaces } = spacesOf(docs, targets, sessions);
  const items = activityItems(sessions, spaces);
  const open = (session: Session) => router.push({ pathname: "/session/[key]", params: { key: session.key } });

  return <View style={styles.screen}>
    <Stack.Screen options={{ title: "Activity" }} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.md }]}>
      <ActivityList items={items} showMachine={targets.length > 1} onSelect={({ session }) => open(session)} />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: space.md } });

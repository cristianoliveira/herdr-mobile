import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { Space } from "../spaces";
import { AGENTS, startAgent, useInstalledAgents } from "./new-session";
import { Sheet } from "./Sheet";
import { colors, radius, space as gap } from "./theme";

export function NewSessionSheet({ space, onClose }: { space: Space | null; onClose: () => void }) {
  const [starting, setStarting] = useState<string | null>(null);
  const installed = useInstalledAgents(space?.target);
  const agents = installed ? AGENTS.filter((a) => installed.includes(a.cmd)) : AGENTS;

  const start = async (cmd: string) => {
    if (!space) return;
    setStarting(cmd);
    try {
      const key = await startAgent(space, cmd);
      onClose();
      router.push({ pathname: "/session/[key]", params: { key } });
    } catch (e) {
      Alert.alert("Could not start it", e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(null);
    }
  };

  return (
    <Sheet visible={!!space} onClose={onClose}>
      <Text style={styles.title} numberOfLines={1}>
        New agent in <Text style={styles.name}>{space?.name}</Text>
      </Text>
      {installed && agents.length === 0 && <Text style={styles.note}>Neither pi nor claude is installed on {space?.target.label}.</Text>}
      <View style={styles.list}>
        {agents.map((a) => (
          <Pressable
            key={a.cmd}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            disabled={!installed || !!starting}
            onPress={() => void start(a.cmd)}
            style={({ pressed }) => [styles.agent, pressed && styles.pressed, (!installed || (starting && starting !== a.cmd)) && styles.off]}
          >
            <Text style={styles.label}>{a.label}</Text>
            {starting === a.cmd && <ActivityIndicator color={colors.text} />}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.muted, fontSize: 13, marginHorizontal: 14, marginBottom: gap.xs },
  name: { color: colors.text, fontWeight: "700" },
  list: { marginBottom: gap.sm },
  agent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 18, borderRadius: radius.md },
  pressed: { backgroundColor: colors.surfaceHigh },
  off: { opacity: 0.4 },
  label: { color: colors.text, fontSize: 18, fontWeight: "600" },
  note: { color: colors.muted, fontSize: 14, padding: 14 },
});

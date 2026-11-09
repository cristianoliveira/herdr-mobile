import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { Space } from "../spaces";
import { sessionChoices, startSession, useInstalledAgents } from "./new-session";
import { Sheet } from "./Sheet";
import { colors, radius, space as gap } from "./theme";

export function NewSessionSheet({ space, onClose }: { space: Space | null; onClose: () => void }) {
  const [starting, setStarting] = useState<string | null>(null);
  const installed = useInstalledAgents(space?.target);
  const choices = sessionChoices(installed);

  const start = async (cmd?: string) => {
    if (!space || starting) return;
    setStarting(cmd ?? "shell");
    try {
      const key = await startSession(space, cmd);
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
        New terminal in <Text style={styles.name}>{space?.name}</Text>
      </Text>
      {installed?.length === 0 && <Text style={styles.note}>No agents found on {space?.target.label}. You can still open a shell.</Text>}
      <View style={styles.list}>
        {choices.map((a) => (
          <Pressable
            key={a.cmd ?? "shell"}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            disabled={(!!a.cmd && installed === null) || !!starting}
            onPress={() => void start(a.cmd)}
            style={({ pressed }) => [styles.agent, pressed && styles.pressed, ((!!a.cmd && installed === null) || (starting && starting !== (a.cmd ?? "shell"))) && styles.off]}
          >
            <Text style={styles.label}>{a.label}</Text>
            {starting === (a.cmd ?? "shell") && <ActivityIndicator color={colors.text} />}
            {!a.cmd && <Text style={styles.note}>Default shell</Text>}
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
  agent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 18, minHeight: 48, borderRadius: radius.md },
  pressed: { backgroundColor: colors.surfaceHigh },
  off: { opacity: 0.4 },
  label: { color: colors.text, fontSize: 18, fontWeight: "600" },
  note: { color: colors.muted, fontSize: 14, padding: 14 },
});

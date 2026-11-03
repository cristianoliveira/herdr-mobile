import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { fleet } from "../fleet-store";
import type { Target } from "../hc/fleet";
import { AGENTS, lastTarget, startAgent, useMachineAgents } from "./new-session";
import { Sheet } from "./Sheet";
import { colors, radius, space } from "./theme";

export function NewSessionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [last, setLast] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const targets = visible ? fleet.targets() : [];
  const machines = useMachineAgents(targets, visible);

  useEffect(() => {
    if (visible) lastTarget().then(setLast);
  }, [visible]);

  const ordered = [...targets].sort((a, b) => Number(b.coreId === last) - Number(a.coreId === last));
  const probed = targets.filter((t) => machines[t.coreId]);
  const none = targets.length > 0 && probed.length === targets.length && probed.every((t) => machines[t.coreId]!.agents.length === 0);

  const start = async (target: Target, cmd: string) => {
    const home = machines[target.coreId]?.home;
    if (!home) return;
    const id = `${target.coreId}:${cmd}`;
    setStarting(id);
    try {
      const key = await startAgent(target, cmd, home);
      onClose();
      router.push({ pathname: "/session/[key]", params: { key } });
    } catch (e) {
      Alert.alert("Could not start it", e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      {targets.length === 0 && <Text style={styles.note}>No machine is connected right now.</Text>}
      {none && <Text style={styles.note}>Neither pi nor claude is installed on your machines.</Text>}
      {ordered.map((target) => {
        const found = machines[target.coreId];
        const agents = found ? AGENTS.filter((a) => found.agents.includes(a.cmd)) : AGENTS;
        if (found && agents.length === 0) return null;
        return (
          <View key={target.coreId} style={styles.group}>
            {targets.length > 1 && <Text style={styles.machine}>{target.label}</Text>}
            {agents.map((a) => {
              const id = `${target.coreId}:${a.cmd}`;
              return (
                <Pressable
                  key={a.cmd}
                  accessibilityRole="button"
                  accessibilityLabel={targets.length > 1 ? `${a.label} on ${target.label}` : a.label}
                  disabled={!found || !!starting}
                  onPress={() => void start(target, a.cmd)}
                  style={({ pressed }) => [styles.agent, pressed && styles.pressed, (!found || (starting && starting !== id)) && styles.off]}
                >
                  <Text style={styles.label}>{a.label}</Text>
                  {starting === id && <ActivityIndicator color={colors.text} />}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: space.sm },
  machine: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginHorizontal: 14, marginTop: space.sm, marginBottom: space.xs },
  agent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 18, borderRadius: radius.md },
  pressed: { backgroundColor: colors.surfaceHigh },
  off: { opacity: 0.4 },
  label: { color: colors.text, fontSize: 18, fontWeight: "600" },
  note: { color: colors.muted, fontSize: 14, padding: 14 },
});

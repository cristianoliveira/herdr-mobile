import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "../hc/fleet";
import { StatusDot } from "./Dot";
import { agents, ago, projectName, taskName } from "./session-display";
import { colors, fonts, radius, space } from "./theme";

export function AgentList({ sessions, onSelect }: { sessions: Session[]; onSelect: (s: Session) => void }) {
  const list = agents(sessions);
  const machines = new Set(list.map((s) => s.machine));
  return (
    <View>
      {list.map((s) => (
        <AgentRow key={s.key} session={s} showMachine={machines.size > 1} onPress={() => onSelect(s)} />
      ))}
    </View>
  );
}

function AgentRow({ session, showMachine, onPress }: { session: Session; showMachine: boolean; onPress: () => void }) {
  const t = session.terminal;
  const project = projectName(session);
  const task = taskName(session);
  const msg = t.status?.msg && !task.includes(t.status.msg) ? t.status.msg : null;
  const sub = [showMachine ? session.machine : null, msg].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.flex}>
        <Text style={styles.line} numberOfLines={1}>
          <Text style={styles.project}>{project}</Text>
          {task ? <Text style={styles.task}> · {task}</Text> : null}
        </Text>
        {sub ? (
          <Text style={[styles.sub, t.status?.state === "blocked" && { color: colors.blocked }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text style={styles.age}>{ago(t.status_ms ?? t.created_ms)}</Text>
      <View style={styles.indicator}>
        <StatusDot session={session} size={12} spin />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md - 2, paddingHorizontal: space.md - 2, paddingVertical: space.md, borderRadius: radius.md },
  rowPressed: { backgroundColor: colors.surface },
  flex: { flex: 1 },
  line: { fontFamily: fonts.mono, fontSize: 15 },
  project: { color: colors.text, fontWeight: "700" },
  task: { color: colors.muted },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  age: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
  indicator: { width: 22, alignItems: "center" },
});

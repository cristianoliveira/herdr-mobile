import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ActivityItem } from "../activity";
import { Dot } from "./Dot";
import { ago, agentTitle, shortPath } from "./session-display";
import { colors, fonts, radius, space as gap } from "./theme";

const labels = { waiting: "Waiting for input", error: "Error", completed: "Completed", working: "Working", idle: "Idle", unknown: "Status unknown" } as const;

export function ActivityList({ items, showMachine, onSelect }: { items: ActivityItem[]; showMachine: boolean; onSelect: (item: ActivityItem) => void }) {
  if (!items.length) return <Text style={styles.empty}>No session activity yet.</Text>;
  return <View>{items.map((item) => {
    const { session, kind, space } = item;
    const context = [space?.name ?? "Not in a space", showMachine ? session.machine : null, shortPath(session.terminal.cwd)].filter(Boolean).join(" · ");
    return <Pressable key={session.key} onPress={() => onSelect(item)} accessibilityRole="button" accessibilityLabel={`${labels[kind]}: ${agentTitle(session)}, ${context}`} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <ActivityDot kind={kind} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{agentTitle(session)}</Text>
        <Text style={[styles.state, (kind === "waiting" || kind === "error") && styles.attention]} numberOfLines={1}>{labels[kind]}{session.terminal.state !== "finished" && session.terminal.status?.msg ? ` · ${session.terminal.status.msg}` : ""}</Text>
        <Text style={styles.context} numberOfLines={1}>{context}</Text>
      </View>
      <Text style={styles.age}>{item.changedAt === null ? "—" : `${ago(item.changedAt)} ${item.timeSource}`}</Text>
    </Pressable>;
  })}</View>;
}

function ActivityDot({ kind }: { kind: ActivityItem["kind"] }) {
  const color = kind === "waiting" ? colors.blocked
    : kind === "error" ? colors.error
      : kind === "working" ? colors.working
        : kind === "completed" || kind === "idle" ? colors.done
          : colors.border;
  return <Dot color={color} hollow={kind === "completed" || kind === "idle" || kind === "unknown"} size={10} />;
}

const styles = StyleSheet.create({
  empty: { color: colors.muted, padding: gap.md },
  row: { flexDirection: "row", alignItems: "center", gap: gap.md, padding: gap.md, borderRadius: radius.md },
  pressed: { backgroundColor: colors.surface },
  info: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontFamily: fonts.mono },
  state: { color: colors.muted, fontSize: 13, marginTop: 2 },
  attention: { color: colors.blocked },
  context: { color: colors.muted, fontSize: 12, marginTop: 2 },
  age: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
});

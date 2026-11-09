import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "../hc/fleet";
import { byUrgency, needsYou, type Space } from "../spaces";
import { StatusDot } from "./Dot";
import { ago, agentTitle } from "./session-display";
import { colors, fonts, radius, space as gap } from "./theme";

type Props = {
  spaces: Space[];
  loose: Session[];
  showMachine: boolean;
  onSelect: (s: Session) => void;
  onStart?: (space: Space) => void;
};

export function SpaceList({ spaces, loose, showMachine, onSelect, onStart }: Props) {
  return (
    <View>
      {spaces.map((sp) => (
        <View key={sp.key} style={styles.space}>
          <View style={styles.head}>
            <Text style={styles.name} numberOfLines={1}>
              {sp.name}
            </Text>
            {sp.factory && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>factory</Text>
              </View>
            )}
            {showMachine && <Text style={styles.machine}>{sp.target.label}</Text>}
            <View style={styles.flex} />
            {onStart && <Pressable
              hitSlop={10}
              onPress={() => onStart(sp)}
              accessibilityRole="button"
              accessibilityLabel={`New agent in ${sp.name}`}
              style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>}
          </View>
          {sp.agents.map((s) => (
            <AgentRow key={s.key} session={s} sub={s.parentKey !== null && sp.agents.some((x) => x.key === s.parentKey)} onPress={() => onSelect(s)} />
          ))}
        </View>
      ))}
      {loose.length > 0 && (
        <View style={styles.space}>
          <View style={styles.head}>
            <Text style={[styles.name, styles.dim]}>Not in a space</Text>
          </View>
          {loose.map((s) => (
            <AgentRow key={s.key} session={s} sub={false} onPress={() => onSelect(s)} />
          ))}
        </View>
      )}
    </View>
  );
}

/** The agents that need you, most urgent first, each with the space it belongs to. */
export function InboxList({ spaces, loose, showMachine, onSelect }: Omit<Props, "onStart">) {
  const rows = [
    ...spaces.flatMap((sp) => sp.agents.map((session) => ({ session, place: showMachine ? `${sp.name} · ${sp.target.label}` : sp.name }))),
    ...loose.map((session) => ({ session, place: showMachine ? `Not in a space · ${session.machine}` : "Not in a space" })),
  ].filter(({ session }) => needsYou(session)).sort((a, b) => byUrgency(a.session, b.session));
  return (
    <View>
      {rows.map(({ session, place }) => (
        <AgentRow key={session.key} session={session} sub={false} place={place} onPress={() => onSelect(session)} />
      ))}
    </View>
  );
}

function AgentRow({ session, sub, place, onPress }: { session: Session; sub: boolean; place?: string; onPress: () => void }) {
  const t = session.terminal;
  const title = agentTitle(session);
  const msg = t.status?.msg && !title.includes(t.status.msg) ? t.status.msg : null;
  const blocked = t.status?.state === "blocked" || t.status?.state === "error";
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, sub && styles.child, pressed && styles.rowPressed]}>
      <View style={styles.indicator}>
        <StatusDot session={session} size={10} spin />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {msg ? (
          <Text style={[styles.msg, blocked && { color: colors.blocked }]} numberOfLines={1}>
            {msg}
          </Text>
        ) : null}
        {place ? (
          <Text style={styles.place} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
      <Text style={styles.age}>{ago(t.status_ms ?? t.created_ms)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  space: { marginBottom: gap.lg },
  head: { flexDirection: "row", alignItems: "center", gap: gap.sm, paddingHorizontal: gap.sm, minHeight: 36 },
  name: { color: colors.text, fontSize: 15, fontWeight: "700", fontFamily: fonts.mono, flexShrink: 1 },
  dim: { color: colors.muted },
  tag: { borderRadius: radius.sm, backgroundColor: colors.accent + "26", paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { color: colors.accent, fontSize: 10, fontWeight: "700" },
  machine: { color: colors.muted, fontSize: 12 },
  flex: { flex: 1 },
  add: { width: 32, height: 32, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  addPressed: { backgroundColor: colors.surfaceHigh },
  row: { flexDirection: "row", alignItems: "center", gap: gap.md, paddingLeft: gap.sm, paddingRight: gap.sm, paddingVertical: gap.md, borderRadius: radius.md },
  child: { paddingLeft: gap.xl + gap.sm },
  rowPressed: { backgroundColor: colors.surface },
  indicator: { width: 20, alignItems: "center" },
  title: { color: colors.text, fontSize: 15 },
  msg: { color: colors.muted, fontSize: 13, marginTop: 2 },
  place: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono, marginTop: 2 },
  age: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
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
  /** A long press: the session's actions. */
  onActions?: (s: Session) => void;
  /** Swiping a row left offers this. */
  onCloseSession?: (s: Session) => void;
  onStart?: (space: Space) => void;
};

export function SpaceList({ spaces, loose, showMachine, onSelect, onActions, onCloseSession, onStart }: Props) {
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
            <AgentRow key={s.key} session={s} sub={s.parentKey !== null && sp.agents.some((x) => x.key === s.parentKey)} onPress={() => onSelect(s)} onLongPress={onActions && (() => onActions(s))} onClose={onCloseSession && (() => onCloseSession(s))} />
          ))}
        </View>
      ))}
      {loose.length > 0 && (
        <View style={styles.space}>
          <View style={styles.head}>
            <Text style={[styles.name, styles.dim]}>Not in a space</Text>
          </View>
          {loose.map((s) => (
            <AgentRow key={s.key} session={s} sub={false} onPress={() => onSelect(s)} onLongPress={onActions && (() => onActions(s))} onClose={onCloseSession && (() => onCloseSession(s))} />
          ))}
        </View>
      )}
    </View>
  );
}

/** The agents that need you, most urgent first, each with the space it belongs to. */
export function InboxList({ spaces, loose, showMachine, onSelect, onActions, onCloseSession }: Omit<Props, "onStart">) {
  const rows = [
    ...spaces.flatMap((sp) => sp.agents.map((session) => ({ session, place: showMachine ? `${sp.name} · ${sp.target.label}` : sp.name }))),
    ...loose.map((session) => ({ session, place: showMachine ? `Not in a space · ${session.machine}` : "Not in a space" })),
  ].filter(({ session }) => needsYou(session)).sort((a, b) => byUrgency(a.session, b.session));
  return (
    <View>
      {rows.map(({ session, place }) => (
        <AgentRow key={session.key} session={session} sub={false} place={place} onPress={() => onSelect(session)} onLongPress={onActions && (() => onActions(session))} onClose={onCloseSession && (() => onCloseSession(session))} />
      ))}
    </View>
  );
}

const ACTION_WIDTH = 88;
let shutOpenRow: (() => void) | null = null;

/** Slide back the row whose Close button shows, if any. */
export function shutSwipedRow() {
  shutOpenRow?.();
}

function SwipeToClose({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;
  const at = useRef(0);
  const [open, setOpen] = useState(false);
  const settle = useRef((to: number) => {
    at.current = to;
    Animated.spring(x, { toValue: to, useNativeDriver: true, overshootClamping: true, speed: 20 }).start();
    setOpen(to !== 0);
    if (to !== 0) {
      if (shutOpenRow && shutOpenRow !== shut) shutOpenRow();
      shutOpenRow = shut;
    } else if (shutOpenRow === shut) shutOpenRow = null;
  }).current;
  const shut = useRef(() => settle(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.max(-ACTION_WIDTH * 1.5, Math.min(0, at.current + g.dx))),
      onPanResponderRelease: (_, g) => settle(at.current + g.dx < -ACTION_WIDTH / 2 || g.vx < -0.5 ? -ACTION_WIDTH : 0),
      onPanResponderTerminate: () => settle(at.current),
    }),
  ).current;

  const shown = useRef(x.interpolate({ inputRange: [-1, 0], outputRange: [1, 0], extrapolate: "clamp" })).current;

  return (
    <View style={styles.swipe}>
      <Animated.View style={[styles.closeAction, { opacity: shown }]}>
        <Pressable
          onPress={() => {
            shut();
            onClose();
          }}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? "auto" : "no-hide-descendants"}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [styles.closeButton, pressed && styles.closePressed]}
        >
          <Ionicons name="close-circle" size={22} color={colors.text} />
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.slide, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
        {open && <Pressable style={StyleSheet.absoluteFill} onPress={shut} accessibilityLabel="Hide Close" />}
      </Animated.View>
    </View>
  );
}

function AgentRow(props: { session: Session; sub: boolean; place?: string; onPress: () => void; onLongPress?: () => void; onClose?: () => void }) {
  return props.onClose ? (
    <SwipeToClose onClose={props.onClose}>
      <AgentRowBody {...props} />
    </SwipeToClose>
  ) : (
    <AgentRowBody {...props} />
  );
}

function AgentRowBody({ session, sub, place, onPress, onLongPress, onClose }: { session: Session; sub: boolean; place?: string; onPress: () => void; onLongPress?: () => void; onClose?: () => void }) {
  const t = session.terminal;
  const title = agentTitle(session);
  const msg = t.status?.msg && !title.includes(t.status.msg) ? t.status.msg : null;
  const blocked = t.status?.state === "blocked" || t.status?.state === "error";
  const actions = [...(onClose ? [{ name: "close", label: "Close" }] : []), ...(onLongPress ? [{ name: "longpress", label: "Actions" }] : [])];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityActions={actions}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === "close" ? onClose?.() : e.nativeEvent.actionName === "longpress" && onLongPress?.())}
      style={({ pressed }) => [styles.row, sub && styles.child, pressed && styles.rowPressed]}>
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
  swipe: { borderRadius: radius.md, overflow: "hidden" },
  slide: { backgroundColor: colors.bg },
  closeAction: { position: "absolute", top: 0, bottom: 0, right: 0, width: ACTION_WIDTH },
  closeButton: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: colors.blocked },
  closePressed: { opacity: 0.8 },
  closeText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: gap.md, paddingLeft: gap.sm, paddingRight: gap.sm, paddingVertical: gap.md, borderRadius: radius.md },
  child: { paddingLeft: gap.xl + gap.sm },
  rowPressed: { backgroundColor: colors.surface },
  indicator: { width: 20, alignItems: "center" },
  title: { color: colors.text, fontSize: 15 },
  msg: { color: colors.muted, fontSize: 13, marginTop: 2 },
  place: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono, marginTop: 2 },
  age: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
});

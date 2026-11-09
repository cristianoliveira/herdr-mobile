import { router } from "expo-router";
import { useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { fleet } from "../fleet-store";
import type { Session } from "../hc/fleet";
import { panelHistory, shouldCaptureForwardSwipe, shouldOpenForwardPanel } from "../panel-navigation";
import { agentTitle } from "./session-display";
import { colors } from "./theme";

export function useForwardPanel(sessions: Session[]) {
  const key = useSyncExternalStore(panelHistory.subscribe, panelHistory.snapshot, panelHistory.snapshot);
  return sessions.find((session) => session.key === key) ?? null;
}

export function openForwardPanel(session: Session) {
  // A terminal can disappear between render and release of a gesture.
  if (!fleet.snapshot().sessions.some((current) => current.key === session.key)) return;
  router.push({ pathname: "/session/[key]", params: { key: session.key } });
}

export function ForwardSwipe({ onForward, children }: { onForward: (() => void) | null; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const current = useRef(onForward);
  const cancelled = useRef(false);
  current.current = onForward;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (event, gesture) => current.current !== null
      && shouldCaptureForwardSwipe(gesture.dx, gesture.dy, event.nativeEvent.pageX - gesture.dx, width, gesture.numberActiveTouches),
    onPanResponderGrant: () => { cancelled.current = false; },
    onPanResponderMove: (_, gesture) => {
      if (gesture.numberActiveTouches !== 1) cancelled.current = true;
    },
    onPanResponderTerminate: () => { cancelled.current = true; },
    onPanResponderRelease: (_, gesture) => {
      if (!cancelled.current && shouldOpenForwardPanel(gesture.dx, gesture.dy)) current.current?.();
    },
  }), [width]);
  return <View style={styles.swipeArea} {...pan.panHandlers}>{children}</View>;
}

export function ForwardPanelAction({ session, onClose }: { session: Session; onClose: () => void }) {
  const title = agentTitle(session);
  return (
    <Pressable
      onPress={() => { onClose(); openForwardPanel(session); }}
      accessibilityRole="button"
      accessibilityLabel={`Forward to last panel: ${title}`}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Text style={styles.actionText}>Forward to last panel</Text>
      <Text style={styles.detail} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  swipeArea: { flex: 1 },
  action: { minHeight: 56, padding: 14, borderRadius: 10 },
  actionText: { color: colors.text, fontSize: 16 },
  detail: { color: colors.muted, fontSize: 13, marginTop: 2 },
  pressed: { backgroundColor: colors.surfaceHigh },
});

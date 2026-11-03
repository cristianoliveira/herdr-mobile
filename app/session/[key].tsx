import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fleet, useFleet } from "../../src/fleet-store";
import { setViewingSession } from "../../src/notifications";
import { useSettings } from "../../src/settings";
import { TerminalInput, type TerminalInputHandle } from "../../src/terminal/TerminalInput";
import { TerminalView, type TerminalHandle, type TerminalMode } from "../../src/terminal/TerminalView";
import { SessionActions } from "../../src/ui/SessionActions";
import { SheetAction } from "../../src/ui/Sheet";
import { useKeyboardHeight } from "../../src/ui/keyboard";
import { sessionTitle } from "../../src/ui/session-display";
import { colors, space } from "../../src/ui/theme";

export default function SessionScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  useFleet();
  const settings = useSettings();
  const route = fleet.route(key);
  const session = route?.session;
  const t = session?.terminal;
  const live = t?.state === "live";
  const [view, setView] = useState<TerminalMode>(settings.defaultMode);
  const [actions, setActions] = useState(false);
  const terminal = useRef<TerminalHandle>(null);
  const input = useRef<TerminalInputHandle>(null);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();

  useEffect(() => {
    setViewingSession(key);
    return () => setViewingSession(null);
  }, [key]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View style={[styles.screen, { paddingBottom: keyboard }]}>
      <Stack.Screen
        options={{
          title: session ? sessionTitle(session) : "Session",
          headerRight: () => (
            <Pressable hitSlop={10} onPress={() => setActions(true)} disabled={!session} accessibilityRole="button" accessibilityLabel="Session actions">
              <Text style={styles.menu}>⋯</Text>
            </Pressable>
          ),
        }}
      />
      {t && route ? (
        <TerminalView
          ref={terminal}
          conn={route.conn}
          address={route.address}
          cols={t.cols}
          rows={t.rows}
          pid={t.pid}
          mode={view}
          fontSize={settings.fontSize}
          onTap={() => input.current?.openKeyboard()}
          onSwipeBack={back}
        />
      ) : (
        <View style={styles.gone}>
          <Text style={styles.muted}>This session is not reachable right now.</Text>
        </View>
      )}
      {live && route ? (
        <TerminalInput ref={input} sessionKey={key} route={route} terminal={terminal} keyboardHeight={keyboard} />
      ) : (
        <View style={{ height: Math.max(insets.bottom, space.sm) }} />
      )}
      <SessionActions session={actions ? session ?? null : null} onClose={() => setActions(false)}>
        <SheetAction
          label={view === "fit" ? "Show at desktop size" : "Fit to phone"}
          detail={view === "fit" ? "Watch at its own size, scaled down; pinch to zoom" : "Reflow it to the phone's width"}
          onPress={() => {
            setActions(false);
            setView((m) => (m === "fit" ? "full" : "fit"));
          }}
        />
      </SessionActions>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  menu: { color: colors.text, fontSize: 24, lineHeight: 26 },
  gone: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.muted },
});

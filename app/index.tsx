import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fleet, useFleet, useMachines } from "../src/fleet-store";
import type { Session } from "../src/hc/fleet";
import { spaces as spacesOf, type Space } from "../src/spaces";
import { Button } from "../src/ui/Button";
import { Dot } from "../src/ui/Dot";
import { CornerActions } from "../src/ui/CornerActions";
import { explainError, linkColor } from "../src/ui/machine-display";
import { NewSessionSheet } from "../src/ui/NewSessionSheet";
import { ProjectSheet } from "../src/ui/ProjectSheet";
import { ForwardSwipe, ForwardPanelAction, openForwardPanel, useForwardPanel } from "../src/ui/PanelForward";
import { Sheet, SheetAction } from "../src/ui/Sheet";
import { SpaceSearchSheet } from "../src/ui/SpaceSearchSheet";
import { SpaceList } from "../src/ui/SpaceList";
import { colors, radius, space } from "../src/ui/theme";
import { applyUpdate, useUpdates } from "../src/updates";

export default function Agents() {
  const { links, sessions, docs } = useFleet();
  const { machines, loaded } = useMachines();
  const forwardPanel = useForwardPanel(sessions);
  const [picking, setPicking] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  useFocusEffect(useCallback(() => () => setActionsOpen(false), []));
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [startIn, setStartIn] = useState<Space | null>(null);
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = useUpdates();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const down = links.filter((l) => l.state !== "connected");
  const connected = links.some((l) => l.state === "connected");
  const targets = fleet.targets();
  const { spaces, loose } = spacesOf(docs, targets, sessions);
  const none = spaces.length === 0 && loose.length === 0;

  const open = (s: Session) => router.push({ pathname: "/session/[key]", params: { key: s.key } });

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (searching ? null : (
            <Pressable onPress={() => setOptionsOpen(true)} style={styles.optionsButton} accessibilityRole="button" accessibilityLabel="Spaces options">
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
            </Pressable>
          )),
        }}
      />
      <ForwardSwipe onForward={forwardPanel && !searching && !picking && !startIn && !optionsOpen && !actionsOpen ? () => openForwardPanel(forwardPanel) : null}>
      <View style={styles.contentRoot} accessibilityElementsHidden={searching || actionsOpen} importantForAccessibility={searching || actionsOpen ? "no-hide-descendants" : "auto"}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => fleet.reconnect()} tintColor={colors.muted} />}
      >
        {loaded && machines.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No machines yet</Text>
            <Text style={styles.emptyText}>Add a machine that runs herdr-core to see its agents here.</Text>
            <Button title="Add a machine" onPress={() => router.push("/machines")} style={styles.emptyButton} />
          </View>
        )}

        {isUpdatePending && (
          <Pressable style={[styles.banner, styles.update]} onPress={() => void applyUpdate()} accessibilityRole="button">
            <Text style={styles.bannerText}>A new version is ready</Text>
            <Text style={styles.updateAction}>Restart</Text>
          </Pressable>
        )}

        {down.length > 0 && (
          <Link href="/machines" asChild>
            <Pressable style={styles.banner} accessibilityRole="button">
              <Dot color={down.some((l) => l.state !== "connecting") ? colors.blocked : linkColor("connecting")} />
              <Text style={styles.bannerText} numberOfLines={2}>
                {down.length > 1
                  ? `${down.length} machines are not connected`
                  : `${down[0].config.name}: ${down[0].state === "connecting" ? "connecting…" : explainError(down[0].error, down[0].config) || "offline"}`}
              </Text>
            </Pressable>
          </Link>
        )}

        <SpaceList spaces={spaces} loose={loose} showMachine={targets.length > 1} onSelect={open} onStart={setStartIn} />

        {machines.length > 0 && connected && none && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No spaces yet</Text>
            <Text style={styles.emptyText}>Open Menu → New to open a project.</Text>
          </View>
        )}
      </ScrollView>

      <Sheet visible={optionsOpen} onClose={() => setOptionsOpen(false)}>
        {forwardPanel && <ForwardPanelAction session={forwardPanel} onClose={() => setOptionsOpen(false)} />}
        <SheetAction label="Settings" onPress={() => { setOptionsOpen(false); router.push("/settings"); }} />
      </Sheet>
      <NewSessionSheet space={startIn} onClose={() => setStartIn(null)} />
      <ProjectSheet visible={picking} spaces={spaces} onClose={() => setPicking(false)} />
      </View>
      </ForwardSwipe>
      {!searching && !picking && !startIn && !optionsOpen && <CornerActions
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        connected={connected}
        onSearch={() => setSearching(true)}
        onNew={() => setPicking(true)}
        onActivity={() => router.push("/activity")}
      />}
      <SpaceSearchSheet visible={searching} spaces={spaces} loose={loose} showMachine={targets.length > 1} onClose={() => setSearching(false)} onSelect={(session) => { setSearching(false); open(session); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  contentRoot: { flex: 1 },
  content: { padding: space.md, paddingTop: space.md },
  banner: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.md - 2 },
  bannerText: { color: colors.text, fontSize: 14, flex: 1 },
  update: { backgroundColor: colors.accent + "22", borderColor: colors.accent, borderWidth: 1 },
  updateAction: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 60, gap: space.md - 2, paddingHorizontal: space.xl },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center" },
  emptyButton: { marginTop: space.sm },
  optionsButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activityItems, EMPTY_ACTIVITY_FILTERS, type ActivityFilters, type ActivityItem } from "../src/activity";
import { dismissActivityItems, loadActivityDismissals, undoActivityItems } from "../src/activity-dismissals";
import { fleet, useFleet } from "../src/fleet-store";
import type { Session } from "../src/hc/fleet";
import { spaces as spacesOf } from "../src/spaces";
import { ActivityList } from "../src/ui/ActivityList";
import { ForwardPanelAction, useForwardPanel } from "../src/ui/PanelForward";
import { colors, space } from "../src/ui/theme";

export default function Activity() {
  const { sessions, docs } = useFleet();
  const forwardPanel = useForwardPanel(sessions);
  const insets = useSafeAreaInsets();
  const [, tick] = useState(0);
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  const [dismissalsLoaded, setDismissalsLoaded] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>(EMPTY_ACTIVITY_FILTERS);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [pendingDismiss, setPendingDismiss] = useState<ActivityItem[] | null>(null);
  const [pendingUndo, setPendingUndo] = useState<ActivityItem[] | null>(null);
  const [undoItems, setUndoItems] = useState<ActivityItem[] | null>(null);
  const [panel, setPanel] = useState<"filters" | "menu" | null>(null);
  const [saving, setSaving] = useState(false);
  const writing = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let mounted = true;
    void loadActivityDismissals().then((saved) => {
      if (mounted) {
        setDismissed(saved);
        setDismissalsLoaded(true);
        setStorageError(null);
      }
    }).catch(() => {
      if (mounted) {
        setDismissalsLoaded(false);
        setStorageError("Could not load saved Activity dismissals.");
      }
    });
    return () => { mounted = false; };
  }, []);
  const targets = fleet.targets();
  const { spaces } = spacesOf(docs, targets, sessions);
  const items = activityItems(sessions, spaces);
  const open = (session: Session) => router.push({ pathname: "/session/[key]", params: { key: session.key } });
  const dismiss = useCallback(async (items: ActivityItem[]) => {
    if (writing.current) return;
    writing.current = true;
    setSaving(true);
    setPendingDismiss(items);
    setPendingUndo(null);
    setStorageError(null);
    try {
      const next = await dismissActivityItems(items);
      setDismissed(next);
      setPendingDismiss(null);
      setUndoItems(items);
    } catch {
      setStorageError("Could not save dismissals. Entries remain visible until saved.");
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }, []);
  const undo = useCallback(async () => {
    if (!undoItems || writing.current) return;
    writing.current = true;
    setSaving(true);
    setPendingUndo(undoItems);
    setPendingDismiss(null);
    setStorageError(null);
    try {
      const next = await undoActivityItems(undoItems);
      setDismissed(next);
      setUndoItems(null);
      setPendingUndo(null);
    } catch {
      setStorageError("Could not save Undo. Dismissed entries remain hidden until saved.");
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }, [undoItems]);
  const retryLoad = () => {
    setStorageError(null);
    void loadActivityDismissals().then((saved) => {
      setDismissed(saved);
      setDismissalsLoaded(true);
    }).catch(() => setStorageError("Could not load saved Activity dismissals."));
  };

  return <View style={styles.screen}>
    <Stack.Screen options={{
      title: "Activity",
      headerRight: () => <View style={styles.headerActions}>
        <Pressable onPress={() => setPanel("filters")} accessibilityRole="button" accessibilityLabel="Activity filters" style={styles.headerButton}><Ionicons name={filters.machine || filters.space ? "filter" : "filter-outline"} size={21} color={filters.machine || filters.space ? colors.accent : colors.text} /></Pressable>
        <Pressable onPress={() => setPanel("menu")} accessibilityRole="button" accessibilityLabel="Activity options" style={styles.headerButton}><Ionicons name="ellipsis-horizontal" size={22} color={colors.text} /></Pressable>
      </View>,
    }} />
    <View style={styles.content}>
      {storageError && <View style={styles.error}>
        <Text style={styles.errorText}>{storageError}</Text>
        {!dismissalsLoaded && <Pressable onPress={retryLoad} accessibilityRole="button" style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>}
        {dismissalsLoaded && pendingDismiss && <Pressable disabled={saving} onPress={() => void dismiss(pendingDismiss)} accessibilityRole="button" style={styles.retry}><Text style={styles.retryText}>Retry save</Text></Pressable>}
        {dismissalsLoaded && pendingUndo && <Pressable disabled={saving} onPress={() => void undo()} accessibilityRole="button" style={styles.retry}><Text style={styles.retryText}>Retry Undo</Text></Pressable>}
      </View>}
      <ActivityList
        bottomInset={insets.bottom + space.xs}
        menuActions={forwardPanel && <ForwardPanelAction session={forwardPanel} onClose={() => setPanel(null)} />}
        panel={panel}
        onPanelChange={setPanel}
        onUndo={() => void undo()}
        undoItems={undoItems}
        dismissEnabled={dismissalsLoaded && !saving}
        items={items}
        dismissed={dismissed}
        filters={filters}
        onFiltersChange={setFilters}
        onDismiss={(item) => dismiss([item])}
        onDismissMany={dismiss}
        showMachine={targets.length > 1}
        onSelect={({ session }) => open(session)}
      />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: space.md },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.xs },
  headerButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  error: { backgroundColor: colors.surface, padding: space.md, borderRadius: 12, marginBottom: space.md },
  errorText: { color: colors.blocked, fontSize: 14 },
  retry: { alignSelf: "flex-start", minHeight: 48, justifyContent: "center", paddingHorizontal: space.sm },
  retryText: { color: colors.accent, fontWeight: "700" },
});

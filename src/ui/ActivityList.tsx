import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ActivityFilters, ActivityItem } from "../activity";
import { activityFilterOptions, activitySelectionId, filterActivity, pruneActivitySelection, shouldCaptureDismissSwipe, shouldRevealDismiss, visibleActivity } from "../activity";
import { Dot } from "./Dot";
import { ago, agentTitle, shortPath } from "./session-display";
import { Sheet } from "./Sheet";
import { colors, fonts, radius, space as gap } from "./theme";

const labels = { waiting: "Waiting for input", error: "Error", completed: "Completed", working: "Working", idle: "Idle", unknown: "Status unknown" } as const;
type Panel = "filters" | "menu" | null;
type FilterPage = "root" | "machine" | "space";

export function ActivityList({ items, dismissed, filters, onFiltersChange, onDismiss, onDismissMany, onUndo, undoItems, dismissEnabled, panel, onPanelChange, showMachine, bottomInset, onSelect, menuActions }: {
  items: ActivityItem[];
  dismissed: Record<string, string>;
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onDismiss: (item: ActivityItem) => void;
  onDismissMany: (items: ActivityItem[]) => void;
  onUndo: () => void;
  undoItems: ActivityItem[] | null;
  dismissEnabled: boolean;
  panel: Panel;
  onPanelChange: (panel: Panel) => void;
  showMachine: boolean;
  bottomInset: number;
  menuActions?: ReactNode;
  onSelect: (item: ActivityItem) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filterPage, setFilterPage] = useState<FilterPage>("root");
  const options = activityFilterOptions(items);
  const scoped = filterActivity(items, filters);
  const shown = visibleActivity(items, dismissed, filters);
  const selectedIds = pruneActivitySelection(selected, items, dismissed, filters);
  const selectedItems = shown.filter((item) => selectedIds.includes(activitySelectionId(item)));
  const selecting = selectedIds.length > 0;

  useEffect(() => {
    setSelected((current) => pruneActivitySelection(current, items, dismissed, filters));
  }, [items, dismissed, filters]);
  useEffect(() => {
    if (panel === "filters") setFilterPage("root");
  }, [panel]);

  const dismissAll = () => Alert.alert(
    "Dismiss activity in this scope?",
    `Hide ${shown.length} ${shown.length === 1 ? "entry" : "entries"}${scopeDescription(filters, options)}. Sessions will keep running.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Dismiss", style: "destructive", onPress: () => onDismissMany(shown) },
    ],
  );
  const selectItem = (item: ActivityItem) => setSelected((current) => {
    const id = activitySelectionId(item);
    return current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id];
  });
  const pickerOptions = filterPage === "machine" ? options.machines : options.spaces;
  const selectedMachine = options.machines.find(({ key }) => key === filters.machine)?.label ?? (filters.machine ? "Unavailable" : "All machines");
  const selectedSpace = options.spaces.find(({ key }) => key === filters.space)?.label ?? (filters.space ? "Unavailable" : "All spaces");

  return <View style={styles.container}>
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + gap.sm }]}>
      {shown.length === 0 ? (
      <Text style={styles.empty}>{items.length === 0 ? "No session activity yet." : scoped.length === 0 ? "No activity matches these filters." : "All matching activity is dismissed."}</Text>
    ) : shown.map((item) => <ActivityRow
      key={item.session.key}
      item={item}
      selected={selectedIds.includes(activitySelectionId(item))}
      selecting={selecting}
      dismissEnabled={dismissEnabled}
      showMachine={showMachine}
      onSelect={() => onSelect(item)}
      onToggleSelect={() => selectItem(item)}
      onLongSelect={() => selectItem(item)}
      onDismiss={() => onDismiss(item)}
    />)}
    </ScrollView>

    {selecting ? <View style={[styles.footer, { marginBottom: bottomInset }]}>
      <Pressable onPress={() => setSelected([])} accessibilityRole="button" accessibilityLabel="Cancel selection" style={styles.barButton}><Text style={styles.barText}>Cancel</Text></Pressable>
      <Text style={styles.selectedCount}>{selectedItems.length} selected</Text>
      <Pressable disabled={!dismissEnabled} onPress={() => { onDismissMany(selectedItems); setSelected([]); }} accessibilityRole="button" accessibilityLabel={`Dismiss ${selectedItems.length} selected sessions`} style={styles.barButton}><Text style={styles.barText}>Dismiss</Text></Pressable>
    </View> : undoItems && <View style={[styles.footer, { marginBottom: bottomInset }]}>
      <Text style={styles.undoText}>{undoItems.length} {undoItems.length === 1 ? "entry" : "entries"} dismissed</Text>
      <Pressable disabled={!dismissEnabled} onPress={onUndo} accessibilityRole="button" accessibilityLabel="Undo dismissal" style={styles.undoButton}><Text style={styles.undoAction}>Undo</Text></Pressable>
    </View>}

    <Sheet visible={panel !== null} onClose={() => onPanelChange(null)}>
      {panel === "filters" ? <>
        {filterPage !== "root" && <Pressable onPress={() => setFilterPage("root")} accessibilityRole="button" style={styles.sheetHeading}><Ionicons name="chevron-back" size={18} color={colors.text} /><Text style={styles.sheetTitle}>Filters</Text></Pressable>}
        {filterPage === "root" ? <>
          <Text style={styles.sheetTitle}>Activity filters</Text>
          <Pressable onPress={() => setFilterPage("machine")} accessibilityRole="button" style={styles.sheetOption}><Text style={styles.sheetLabel}>Machine</Text><Text style={styles.sheetValue}>{selectedMachine} ›</Text></Pressable>
          <Pressable onPress={() => setFilterPage("space")} accessibilityRole="button" style={styles.sheetOption}><Text style={styles.sheetLabel}>Space</Text><Text style={styles.sheetValue}>{selectedSpace} ›</Text></Pressable>
        </> : <ScrollView keyboardShouldPersistTaps="handled">
          {[{ key: "__all__", label: filterPage === "machine" ? "All machines" : "All spaces" }, ...pickerOptions].map(({ key, label }) => (
            <Pressable key={key} accessibilityRole="button" onPress={() => {
              setSelected([]);
              onFiltersChange({ ...filters, [filterPage]: key === "__all__" ? null : key });
              setFilterPage("root");
            }} style={styles.sheetOption}><Text style={styles.sheetLabel}>{label}</Text></Pressable>
          ))}
        </ScrollView>}
      </> : <>
        <Text style={styles.sheetTitle}>Activity options</Text>
        {!selecting && menuActions}
        <Pressable disabled={!dismissEnabled || !shown.length} onPress={() => { onPanelChange(null); dismissAll(); }} accessibilityRole="button" style={styles.sheetOption}>
          <Text style={[styles.sheetLabel, styles.danger]}>Dismiss all in current scope ({shown.length})</Text>
        </Pressable>
      </>}
    </Sheet>
  </View>;
}

function ActivityRow({ item, selected, selecting, dismissEnabled, showMachine, onSelect, onToggleSelect, onLongSelect, onDismiss }: {
  item: ActivityItem;
  selected: boolean;
  selecting: boolean;
  dismissEnabled: boolean;
  showMachine: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
  onLongSelect: () => void;
  onDismiss: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const translateX = useMemo(() => new Animated.Value(0), []);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (event, gesture) => {
      // PanResponder sets x0 only after grant; recover the start before deciding ownership.
      const startX = event.nativeEvent.pageX - gesture.dx;
      return !selecting && dismissEnabled && (shouldCaptureDismissSwipe(gesture.dx, gesture.dy, startX)
        || (revealed && startX > 24 && gesture.dx > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5));
    },
    onMoveShouldSetPanResponder: (event, gesture) => {
      const startX = event.nativeEvent.pageX - gesture.dx;
      return !selecting && dismissEnabled && (shouldCaptureDismissSwipe(gesture.dx, gesture.dy, startX)
        || (revealed && startX > 24 && gesture.dx > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5));
    },
    onPanResponderMove: (_, gesture) => {
      const startingOffset = revealed ? -84 : 0;
      translateX.setValue(Math.max(-84, Math.min(0, startingOffset + gesture.dx)));
    },
    onPanResponderRelease: (_, gesture) => {
      const open = shouldRevealDismiss(gesture.dx, gesture.dy, 64, gesture.x0) || (revealed && gesture.x0 > 24 && gesture.dx < -24);
      setRevealed(open);
      Animated.spring(translateX, { toValue: open ? -84 : 0, useNativeDriver: false, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => {
      setRevealed(false);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
    },
  }), [dismissEnabled, revealed, selecting, translateX]);
  const { session, kind, space } = item;
  useEffect(() => {
    if (selecting || !dismissEnabled) {
      setRevealed(false);
      translateX.setValue(0);
    }
  }, [selecting, dismissEnabled, translateX]);
  const context = [space?.name ?? "Not in a space", showMachine ? session.machine : null, shortPath(session.terminal.cwd)].filter(Boolean).join(" · ");
  const toggle = () => selecting ? onToggleSelect() : onSelect();
  const accessibilityActions = [{ name: "select", label: selected ? "Deselect" : "Select" }, { name: "dismiss", label: "Dismiss from Activity" }];

  return <View style={styles.rowShell}>
    <Pressable disabled={!revealed || !dismissEnabled} accessibilityElementsHidden={!revealed} importantForAccessibility={revealed ? "auto" : "no-hide-descendants"} onPress={onDismiss} accessibilityRole="button" accessibilityLabel={`Dismiss ${agentTitle(session)} from Activity`} style={styles.revealAction}>
      <Ionicons name="close" size={20} color={colors.onAccent} />
      <Text style={styles.revealText}>Dismiss</Text>
    </Pressable>
    <Animated.View {...pan.panHandlers} style={[styles.row, { transform: [{ translateX }] }]}>
      <Pressable
        onPress={toggle}
        onLongPress={dismissEnabled ? onLongSelect : undefined}
        delayLongPress={450}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityActions={dismissEnabled ? accessibilityActions : []}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === "dismiss" && dismissEnabled) onDismiss();
          else if (nativeEvent.actionName === "select" && dismissEnabled) onToggleSelect();
        }}
        accessibilityLabel={`${labels[kind]}: ${agentTitle(session)}, ${context}`}
        style={({ pressed }) => [styles.session, pressed && styles.pressed]}
      >
        {selecting && <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={20} color={selected ? colors.accent : colors.muted} />}
        <ActivityDot kind={kind} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{agentTitle(session)}</Text>
          <Text style={[styles.state, (kind === "waiting" || kind === "error") && styles.attention]} numberOfLines={1}>{labels[kind]}{session.terminal.state !== "finished" && session.terminal.status?.msg ? ` · ${session.terminal.status.msg}` : ""}</Text>
          <Text style={styles.context} numberOfLines={1}>{context}</Text>
        </View>
        <Text style={styles.age}>{item.changedAt === null ? "—" : `${ago(item.changedAt)} ${item.timeSource}`}</Text>
      </Pressable>
    </Animated.View>
  </View>;
}

function scopeDescription(filters: ActivityFilters, options: ReturnType<typeof activityFilterOptions>): string {
  const machine = options.machines.find(({ key }) => key === filters.machine)?.label ?? "unavailable machine";
  const scope = options.spaces.find(({ key }) => key === filters.space)?.label ?? "unavailable space";
  const parts = [filters.machine && ` on ${machine}`, filters.space && (filters.space === "__none__" ? " not in a space" : ` in ${scope}`)].filter(Boolean);
  return parts.join("");
}

function ActivityDot({ kind }: { kind: ActivityItem["kind"] }) {
  const color = kind === "waiting" ? colors.blocked : kind === "error" ? colors.error : kind === "working" ? colors.working : kind === "completed" || kind === "idle" ? colors.done : colors.border;
  return <Dot color={color} hollow={kind === "completed" || kind === "idle" || kind === "unknown"} size={10} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  listContent: { paddingBottom: gap.sm },
  empty: { color: colors.muted, padding: gap.md },
  undoText: { color: colors.text, fontSize: 13 },
  undoButton: { minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "center" },
  undoAction: { color: colors.accent, fontWeight: "700" },
  rowShell: { minHeight: 76, justifyContent: "center", overflow: "hidden", marginBottom: 2 },
  revealAction: { position: "absolute", right: 0, top: 0, bottom: 0, width: 84, alignItems: "center", justifyContent: "center", backgroundColor: colors.error, borderRadius: radius.md },
  revealText: { color: colors.onAccent, fontSize: 11, fontWeight: "700" },
  row: { backgroundColor: colors.bg },
  session: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: gap.md, padding: gap.md, borderRadius: radius.md },
  pressed: { backgroundColor: colors.surface },
  info: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontFamily: fonts.mono },
  state: { color: colors.muted, fontSize: 13, marginTop: 2 },
  attention: { color: colors.blocked },
  context: { color: colors.muted, fontSize: 12, marginTop: 2 },
  age: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
  footer: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: gap.sm, marginTop: gap.xs },
  barButton: { minHeight: 48, minWidth: 64, alignItems: "center", justifyContent: "center" },
  barText: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  selectedCount: { color: colors.text, fontSize: 13 },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: "700", padding: gap.md },
  sheetHeading: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: gap.sm, paddingHorizontal: gap.md },
  sheetOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: gap.md },
  sheetLabel: { color: colors.text, fontSize: 15 },
  sheetValue: { color: colors.muted, fontSize: 13 },
  danger: { color: colors.error },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ActivityFilters, ActivityItem } from "../activity";
import { activityFilterOptions, activitySelectionId, filterActivity, pruneActivitySelection, visibleActivity } from "../activity";
import { Dot } from "./Dot";
import { ago, agentTitle, shortPath } from "./session-display";
import { Sheet } from "./Sheet";
import { colors, fonts, radius, space as gap } from "./theme";

const labels = { waiting: "Waiting for input", error: "Error", completed: "Completed", working: "Working", idle: "Idle", unknown: "Status unknown" } as const;
const ALL = "All";

export function ActivityList({ items, dismissed, filters, onFiltersChange, onDismiss, onDismissMany, dismissEnabled, showMachine, onSelect }: {
  dismissEnabled: boolean;
  items: ActivityItem[];
  dismissed: Record<string, string>;
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onDismiss: (item: ActivityItem) => void;
  onDismissMany: (items: ActivityItem[]) => void;
  showMachine: boolean;
  onSelect: (item: ActivityItem) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [picker, setPicker] = useState<"machine" | "space" | null>(null);
  const options = activityFilterOptions(items);
  const scoped = filterActivity(items, filters);
  const shown = visibleActivity(items, dismissed, filters);
  const selectedIds = pruneActivitySelection(selected, items, dismissed, filters);
  const selectedItems = shown.filter((item) => selectedIds.includes(activitySelectionId(item)));
  useEffect(() => {
    setSelected((current) => pruneActivitySelection(current, items, dismissed, filters));
  }, [items, dismissed, filters]);

  const choose = (kind: "machine" | "space") => setPicker(kind);
  const pickerOptions = picker === "machine" ? options.machines : options.spaces;
  const dismissAll = () => Alert.alert("Dismiss filtered activity?", `Hide ${shown.length} visible ${shown.length === 1 ? "entry" : "entries"}${scopeDescription(filters, options)}. Sessions will keep running.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Dismiss", style: "destructive", onPress: () => { onDismissMany(shown); setSelected([]); } },
  ]);
  const dismissSelected = () => {
    onDismissMany(selectedItems);
    setSelected([]);
  };

  return <View>
    <View style={styles.filters}>
      <Pressable style={styles.filter} accessibilityRole="button" accessibilityLabel={`Filter by machine: ${options.machines.find(({ key }) => key === filters.machine)?.label ?? (filters.machine ? "Unavailable" : ALL)}`} onPress={() => choose("machine")}>
        <Text style={styles.filterText}>Machine: {options.machines.find(({ key }) => key === filters.machine)?.label ?? (filters.machine ? "Unavailable" : ALL)}</Text>
      </Pressable>
      <Pressable style={styles.filter} accessibilityRole="button" accessibilityLabel={`Filter by space: ${options.spaces.find(({ key }) => key === filters.space)?.label ?? (filters.space ? "Unavailable" : ALL)}`} onPress={() => choose("space")}>
        <Text style={styles.filterText}>Space: {options.spaces.find(({ key }) => key === filters.space)?.label ?? (filters.space ? "Unavailable" : ALL)}</Text>
      </Pressable>
    </View>
    <View style={styles.actions}>
      <Pressable disabled={!dismissEnabled || !selectedItems.length} onPress={dismissSelected} accessibilityRole="button" accessibilityLabel={`Dismiss ${selectedItems.length} selected entries`} style={styles.action}>
        <Text style={[styles.actionText, !selectedItems.length && styles.disabled]}>Dismiss selected ({selectedItems.length})</Text>
      </Pressable>
      <Pressable disabled={!dismissEnabled || !shown.length} onPress={dismissAll} accessibilityRole="button" accessibilityLabel={`Dismiss all ${shown.length} filtered entries`} style={styles.action}>
        <Text style={[styles.actionText, !shown.length && styles.disabled]}>Dismiss filtered ({shown.length})</Text>
      </Pressable>
    </View>
    {shown.length === 0 ? (
      <Text style={styles.empty}>{items.length === 0 ? "No session activity yet." : scoped.length === 0 ? "No activity matches these filters." : "All matching activity is dismissed."}</Text>
    ) : shown.map((item) => {
      const { session, kind, space } = item;
      const isSelected = selectedIds.includes(activitySelectionId(item));
      const context = [space?.name ?? "Not in a space", showMachine ? session.machine : null, shortPath(session.terminal.cwd)].filter(Boolean).join(" · ");
      return <View key={session.key} style={styles.row}>
        <Pressable onPress={() => setSelected((current) => isSelected ? current.filter((id) => id !== activitySelectionId(item)) : [...current, activitySelectionId(item)])} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} accessibilityLabel={`Select ${agentTitle(session)}`} style={styles.select}>
          <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={22} color={isSelected ? colors.accent : colors.muted} />
        </Pressable>
        <Pressable onPress={() => onSelect(item)} accessibilityRole="button" accessibilityLabel={`${labels[kind]}: ${agentTitle(session)}, ${context}`} style={({ pressed }) => [styles.session, pressed && styles.pressed]}>
          <ActivityDot kind={kind} />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{agentTitle(session)}</Text>
            <Text style={[styles.state, (kind === "waiting" || kind === "error") && styles.attention]} numberOfLines={1}>{labels[kind]}{session.terminal.state !== "finished" && session.terminal.status?.msg ? ` · ${session.terminal.status.msg}` : ""}</Text>
            <Text style={styles.context} numberOfLines={1}>{context}</Text>
          </View>
          <Text style={styles.age}>{item.changedAt === null ? "—" : `${ago(item.changedAt)} ${item.timeSource}`}</Text>
        </Pressable>
        <Pressable disabled={!dismissEnabled} onPress={() => onDismiss(item)} accessibilityRole="button" accessibilityLabel={`Dismiss ${agentTitle(session)} from Activity`} style={styles.dismiss}>
          <Ionicons name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>;
    })}
    <Sheet visible={picker !== null} onClose={() => setPicker(null)}>
      <Text style={styles.pickerTitle}>Filter by {picker}</Text>
      <ScrollView keyboardShouldPersistTaps="handled">
        {[{ key: "__all__", label: ALL }, ...pickerOptions].map(({ key, label }) => (
          <Pressable key={key} accessibilityRole="button" onPress={() => {
            setSelected([]);
            onFiltersChange({ ...filters, [picker!]: key === "__all__" ? null : key });
            setPicker(null);
          }} style={styles.option}>
            <Text style={styles.filterText}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
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
  empty: { color: colors.muted, padding: gap.md },
  filters: { flexDirection: "row", gap: gap.sm, flexWrap: "wrap", marginBottom: gap.xs },
  filter: { minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: gap.sm, paddingVertical: gap.sm, justifyContent: "center" },
  filterText: { color: colors.text, fontSize: 12 },
  pickerTitle: { color: colors.text, fontSize: 16, fontWeight: "700", padding: gap.md },
  option: { minHeight: 48, justifyContent: "center", paddingHorizontal: gap.md },
  actions: { flexDirection: "row", justifyContent: "space-between", marginBottom: gap.sm },
  action: { minHeight: 44, justifyContent: "center", paddingVertical: gap.sm, paddingHorizontal: gap.xs },
  actionText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  disabled: { color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", borderRadius: radius.md },
  select: { minWidth: 44, minHeight: 56, alignItems: "center", justifyContent: "center" },
  session: { flex: 1, flexDirection: "row", alignItems: "center", gap: gap.md, padding: gap.md, minHeight: 68 },
  pressed: { backgroundColor: colors.surface },
  info: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontFamily: fonts.mono },
  state: { color: colors.muted, fontSize: 13, marginTop: 2 },
  attention: { color: colors.blocked },
  context: { color: colors.muted, fontSize: 12, marginTop: 2 },
  age: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
  dismiss: { minWidth: 44, minHeight: 56, alignItems: "center", justifyContent: "center" },
});

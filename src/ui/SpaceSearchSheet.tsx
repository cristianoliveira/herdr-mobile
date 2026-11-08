import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Session } from "../hc/fleet";
import { coreOf, type Space } from "../spaces";
import { searchSpaces, type SpaceSearchScope } from "../space-search";
import { SpaceList } from "./SpaceList";
import { Sheet } from "./Sheet";
import { TextField } from "./TextField";
import { colors, radius, space } from "./theme";

type Props = {
  visible: boolean;
  spaces: Space[];
  loose: Session[];
  showMachine: boolean;
  onClose: () => void;
  onSelect: (session: Session) => void;
};

export function SpaceSearchSheet({ visible, spaces, loose, showMachine, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SpaceSearchScope>({ kind: "all" });
  const [choosingScope, setChoosingScope] = useState(false);
  const input = useRef<TextInput>(null);
  const focusInput = useCallback(() => input.current?.focus(), []);
  const results = useMemo(() => searchSpaces(spaces, loose, query, scope), [spaces, loose, query, scope]);
  const machineOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const item of spaces) labels.set(item.target.coreId, item.target.label);
    for (const item of loose) if (!labels.has(coreOf(item.key))) labels.set(coreOf(item.key), item.machine);
    const counts = new Map<string, number>();
    for (const label of labels.values()) counts.set(label, (counts.get(label) ?? 0) + 1);
    const seen = new Map<string, number>();
    return [...labels].map(([coreId, label]) => {
      const duplicate = (counts.get(label) ?? 0) > 1;
      const index = (seen.get(label) ?? 0) + 1;
      seen.set(label, index);
      return { coreId, label: duplicate ? `${label} (${index})` : label };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [spaces, loose]);
  const scopeLabel = scope.kind === "all" ? "All spaces" : scope.kind === "machine"
    ? machineOptions.find((option) => option.coreId === scope.coreId)?.label ?? "Unavailable machine"
    : spaces.find((item) => item.key === scope.key)?.name ?? "Unavailable space";

  const close = () => {
    Keyboard.dismiss();
    setChoosingScope(false);
    onClose();
  };
  const choose = (next: SpaceSearchScope) => {
    setScope(next);
    setChoosingScope(false);
    focusInput();
  };

  return <Sheet visible={visible} onClose={close} onShow={focusInput} inline={Platform.OS === "android"} contentStyle={styles.searchSheet}>
    {choosingScope ? (
      <ScrollView keyboardShouldPersistTaps="always" style={styles.results}>
        <ScopeOption label="All spaces" detail="Every machine and space" selected={scope.kind === "all"} onPress={() => choose({ kind: "all" })} />
        {machineOptions.map(({ coreId, label }) => (
          <ScopeOption key={`machine:${coreId}`} label={label} detail="Machine" selected={scope.kind === "machine" && scope.coreId === coreId} onPress={() => choose({ kind: "machine", coreId })} />
        ))}
        {spaces.map((item) => (
          <ScopeOption key={`space:${item.key}`} label={item.name} detail={item.target.label} selected={scope.kind === "space" && scope.key === item.key} onPress={() => choose({ kind: "space", key: item.key })} />
        ))}
      </ScrollView>
    ) : (
      <ScrollView keyboardShouldPersistTaps="always" style={styles.results}>
        {results.spaces.length === 0 && results.loose.length === 0 ? (
          <Text style={styles.empty}>{query.trim() ? "No spaces or agents match." : "No spaces or agents in this scope."}</Text>
        ) : (
          <SpaceList spaces={results.spaces} loose={results.loose} showMachine={showMachine} onSelect={(session) => { close(); onSelect(session); }} />
        )}
      </ScrollView>
    )}

    <View style={styles.footer}>
      <View style={styles.footerActions}>
        <Pressable onPress={() => {
          if (choosingScope) {
            setChoosingScope(false);
            focusInput();
          } else {
            Keyboard.dismiss();
            setChoosingScope(true);
          }
        }} accessibilityRole="button" accessibilityLabel={`Search scope: ${scopeLabel}`} style={styles.scopeChip}>
          <Ionicons name="layers-outline" size={16} color={colors.accent} />
          <Text style={styles.scopeText} numberOfLines={1}>{scopeLabel}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close search" style={styles.closeButton}><Text style={styles.closeText}>Close</Text></Pressable>
      </View>
      <View style={styles.searchRow}>
        <TextField
          ref={input}
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search spaces and agents"
          accessibilityLabel="Search spaces, agents, and status messages"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
          inset
          style={styles.search}
        />
        {!!query && <Pressable onPress={() => { setQuery(""); focusInput(); }} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clearButton}>
          <Ionicons name="close-circle" size={20} color={colors.muted} />
        </Pressable>}
      </View>
    </View>
  </Sheet>;
}

function ScopeOption({ label, detail, selected, onPress }: { label: string; detail: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${label}${detail ? `, ${detail}` : ""}`} style={styles.option}>
    <View style={styles.optionText}>
      <Text style={styles.optionLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.optionDetail} numberOfLines={1}>{detail}</Text>
    </View>
    {selected && <Ionicons name="checkmark" size={18} color={colors.accent} />}
  </Pressable>;
}

const styles = StyleSheet.create({
  searchSheet: { height: "80%", maxHeight: "85%" },
  results: { flex: 1, minHeight: 100 },
  footer: { paddingTop: space.xs },
  footerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scopeChip: { flex: 1, minHeight: 48, maxWidth: "75%", flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md, borderRadius: radius.full, backgroundColor: colors.bg, marginRight: space.xs },
  scopeText: { color: colors.text, fontSize: 13, flexShrink: 1 },
  closeButton: { minWidth: 64, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm },
  closeText: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center" },
  search: { flex: 1, minHeight: 48 },
  clearButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.muted, padding: space.md, textAlign: "center" },
  option: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, borderRadius: radius.md },
  optionText: { flex: 1, paddingRight: space.sm },
  optionLabel: { color: colors.text, fontSize: 15 },
  optionDetail: { color: colors.muted, fontSize: 12, marginTop: 2 },
});

// A layout's bottom tabs.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TabItem } from "../../definition/layout";
import { useAppData } from "../../mods/app-data";
import { useShared } from "../../mods/shared";
import { Asset } from "./Asset";

export function TabBar({ tabs, active, onSelect }: { tabs: TabItem[]; active: string; onSelect: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const shared = useShared();
  const { theme: t } = useAppData();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 4, backgroundColor: t.chrome, borderTopColor: t.border }]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const on = tab.id === active;
        const color = on ? t.accent : t.muted;
        const badge = tab.badge ? Number(shared[tab.badge] ?? 0) : 0;
        return (
          <Pressable key={tab.id} style={styles.tab} onPress={() => onSelect(tab.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge > 0 ? `${tab.title}, ${badge}` : tab.title}>
            <View>
              {tab.icon.includes("/") ? <Asset path={tab.icon} tint={color} size={24} /> : <Ionicons name={tab.icon as any} size={24} color={color} />}
              {badge > 0 && (
                <View style={[styles.badge, { backgroundColor: t.blocked }]}>
                  <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color }]}>{tab.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  label: { fontSize: 11, fontWeight: "600" },
  badge: { position: "absolute", top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
});

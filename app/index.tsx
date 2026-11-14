// The root screen: the definition's layout. A tabs root draws a bottom tab
// bar; every root screen gets its header mod and the app's menu.
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useDefinition } from "../src/definition/controller";
import { validateLayout, type Screen } from "../src/definition/layout";
import { SHIPPED_DEFINITION } from "../src/definition/controller";
import { useAppData } from "../src/mods/app-data";
import { selectTab, useActiveTab } from "../src/mods/nav";
import { AppMenu } from "../src/ui/mods/AppMenu";
import { LayoutView } from "../src/ui/mods/LayoutView";
import { ModBlock } from "../src/ui/mods/ModBlock";
import { TabBar } from "../src/ui/mods/TabBar";

const SHIPPED_MAIN = validateLayout(JSON.parse(SHIPPED_DEFINITION["layouts/main.json"])).layout!;

function Header({ screen, id }: { screen: Screen; id: string }) {
  return (
    <Stack.Screen
      options={{
        title: screen.title ?? "",
        headerRight: () => (
          <View style={styles.header}>
            {screen.header && <ModBlock mod={screen.header.mod} props={screen.header.props ?? {}} copyId={`${id}/header`} />}
            <AppMenu />
          </View>
        ),
      }}
    />
  );
}

export default function Root() {
  const def = useDefinition();
  const { theme: t } = useAppData();
  const layout = def.layouts[def.settings.layout] ?? def.layouts.main ?? SHIPPED_MAIN;
  const root = layout.root;
  const activeId = useActiveTab(root.type === "tabs" ? root.id : "");

  if (root.type !== "tabs") {
    return (
      <View style={[styles.screen, { backgroundColor: t.background }]}>
        <Header screen={root} id={`root/${root.id}`} />
        <LayoutView node={root} screen={`root/${root.id}`} />
      </View>
    );
  }
  const active = root.children.find((c) => c.id === activeId) ?? root.children[0];
  return (
    <View style={[styles.screen, { backgroundColor: t.background }]}>
      <Header screen={active.screen} id={`${root.id}/${active.id}`} />
      {root.children.map((tab) => (
        <View key={tab.id} style={[styles.screen, tab.id !== active.id && styles.hidden]}>
          <LayoutView node={tab.screen} screen={`${root.id}/${tab.id}`} />
        </View>
      ))}
      <TabBar tabs={root.children} active={active.id} onSelect={(id) => selectTab(root.id, id)} />
      {!root.children.length && <Text style={{ color: t.muted }}>This layout has no tabs.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hidden: { display: "none" },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
});

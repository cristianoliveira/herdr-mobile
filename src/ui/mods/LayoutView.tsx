// A layout screen's node tree: blocks show mods; rows and columns arrange them.
import { View, type ViewStyle } from "react-native";
import type { LayoutNode } from "../../definition/layout";
import { useAppData } from "../../mods/app-data";
import { ModBlock } from "./ModBlock";

function frame(n: LayoutNode, theme: Record<string, string>): ViewStyle {
  const s: ViewStyle = {};
  if (n.size && "px" in n.size) Object.assign(s, { flexGrow: 0, flexShrink: 0, flexBasis: n.size.px });
  else if (n.size && "weight" in n.size) s.flex = n.size.weight;
  else s.flex = 1;
  if (typeof n.padding === "number") s.padding = n.padding;
  else if (Array.isArray(n.padding)) Object.assign(s, { paddingVertical: n.padding[0], paddingHorizontal: n.padding[1] });
  if (n.background) s.backgroundColor = theme[n.background] ?? n.background;
  return s;
}

export function LayoutView({ node, screen }: { node: LayoutNode; screen: string }) {
  const { theme } = useAppData();
  if (node.type === "block") {
    return <ModBlock mod={node.content.mod} props={node.content.props ?? {}} copyId={`${screen}/${node.id}`} style={frame(node, theme)} />;
  }
  return (
    <View style={[{ flexDirection: node.type === "row" ? "row" : "column", gap: node.gap }, frame(node, theme)]}>
      {node.children.map((c) => (
        <LayoutView key={c.id} node={c} screen={screen} />
      ))}
    </View>
  );
}

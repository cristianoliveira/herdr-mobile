// layouts/<name>.json: the UI as data. Desktop's block/row/column nodes, plus
// bottom tabs; a screen is a node with a title and an optional header mod.
export type Size = { px: number } | { weight: number };
export type ModRef = { mod: string; props?: Record<string, unknown> };
export type Block = { type: "block"; id: string; content: ModRef; size?: Size; padding?: number | [number, number]; background?: string };
export type Container = { type: "row" | "column"; id: string; children: LayoutNode[]; gap?: number; padding?: number | [number, number]; background?: string; size?: Size };
export type LayoutNode = Block | Container;
export type Screen = LayoutNode & { title?: string; header?: ModRef };
export type TabItem = { id: string; title: string; icon: string; badge?: string; screen: Screen };
export type Tabs = { type: "tabs"; id: string; children: TabItem[] };
export type Layout = { root: Screen | Tabs };

type Check = { errors: string[]; ids: Set<string>; mods: Set<string> | null };

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

function only(c: Check, v: Record<string, any>, at: string, keys: string[]) {
  for (const k of Object.keys(v)) if (!keys.includes(k)) c.errors.push(`${at}: unknown field "${k}" (allowed: ${keys.join(", ")})`);
}

function id(c: Check, v: any, at: string) {
  if (typeof v.id !== "string" || !v.id) return void c.errors.push(`${at}.id: needs a string id`);
  if (c.ids.has(v.id)) c.errors.push(`${at}.id: "${v.id}" is used twice`);
  c.ids.add(v.id);
}

function modRef(c: Check, v: any, at: string) {
  if (!isObj(v) || typeof v.mod !== "string" || !v.mod) return void c.errors.push(`${at}: needs { "mod": "<name>", "props"?: {...} }`);
  only(c, v, at, ["mod", "props"]);
  if (v.props !== undefined && !isObj(v.props)) c.errors.push(`${at}.props: needs an object`);
  if (c.mods && !c.mods.has(v.mod)) c.errors.push(`${at}.mod: no mod named "${v.mod}" in mods/`);
}

function size(c: Check, v: any, at: string) {
  if (v === undefined) return;
  const ok = isObj(v) && ((typeof v.px === "number" && Object.keys(v).length === 1) || (typeof v.weight === "number" && Object.keys(v).length === 1));
  if (!ok) c.errors.push(`${at}: needs { "px": n } or { "weight": n }`);
}

const COMMON = ["type", "id", "size", "padding", "background", "title", "header"];

function node(c: Check, v: any, at: string, screen: boolean) {
  if (!isObj(v)) return void c.errors.push(`${at}: needs a node object`);
  id(c, v, at);
  size(c, v.size, `${at}.size`);
  if (v.padding !== undefined && typeof v.padding !== "number" && !(Array.isArray(v.padding) && v.padding.length === 2 && v.padding.every((n: any) => typeof n === "number")))
    c.errors.push(`${at}.padding: needs a number or [vertical, horizontal]`);
  if (v.background !== undefined && typeof v.background !== "string") c.errors.push(`${at}.background: needs a color`);
  if (screen) {
    if (v.title !== undefined && typeof v.title !== "string") c.errors.push(`${at}.title: needs a string`);
    if (v.header !== undefined) modRef(c, v.header, `${at}.header`);
  } else if (v.title !== undefined || v.header !== undefined) {
    c.errors.push(`${at}: only a screen (the root, or a tab's screen) has a title or header`);
  }
  switch (v.type) {
    case "block":
      only(c, v, at, [...COMMON, "content"]);
      modRef(c, v.content, `${at}.content`);
      break;
    case "row":
    case "column":
      only(c, v, at, [...COMMON, "children", "gap"]);
      if (v.gap !== undefined && typeof v.gap !== "number") c.errors.push(`${at}.gap: needs a number`);
      if (!Array.isArray(v.children)) c.errors.push(`${at}.children: needs an array`);
      else v.children.forEach((child: any, i: number) => node(c, child, `${at}.children[${i}]`, false));
      break;
    default:
      c.errors.push(`${at}.type: "${v.type}" is not block, row or column${screen ? " (or tabs at the root)" : ""}`);
  }
}

/** Checks a parsed layout. `mods`: the mod names that exist, to catch missing ones. */
export function validateLayout(value: unknown, mods: Set<string> | null = null): { layout: Layout | null; errors: string[] } {
  const c: Check = { errors: [], ids: new Set(), mods };
  if (!isObj(value)) return { layout: null, errors: ["the layout needs to be an object with a root"] };
  only(c, value, "layout", ["root"]);
  const r = value.root;
  if (isObj(r) && r.type === "tabs") {
    id(c, r, "root");
    only(c, r, "root", ["type", "id", "children"]);
    if (!Array.isArray(r.children) || r.children.length === 0) c.errors.push("root.children: tabs need at least one tab");
    else
      r.children.forEach((t: any, i: number) => {
        const at = `root.children[${i}]`;
        if (!isObj(t)) return void c.errors.push(`${at}: needs { id, title, icon, screen }`);
        only(c, t, at, ["id", "title", "icon", "badge", "screen"]);
        id(c, t, at);
        if (typeof t.title !== "string") c.errors.push(`${at}.title: needs a string`);
        if (typeof t.icon !== "string") c.errors.push(`${at}.icon: needs an Ionicons name or a path in the home`);
        if (t.badge !== undefined && typeof t.badge !== "string") c.errors.push(`${at}.badge: needs the name of a shared key`);
        node(c, t.screen, `${at}.screen`, true);
      });
  } else {
    node(c, r, "root", true);
  }
  return { layout: c.errors.length ? null : (value as Layout), errors: c.errors };
}

/** Every mod a layout uses, in blocks and headers. */
export function modsOf(layout: Layout): string[] {
  const out = new Set<string>();
  const walk = (n: any) => {
    if (n?.header?.mod) out.add(n.header.mod);
    if (n?.type === "block") out.add(n.content.mod);
    for (const c of n?.children ?? []) walk(c.screen ?? c);
  };
  walk(layout.root);
  return [...out];
}

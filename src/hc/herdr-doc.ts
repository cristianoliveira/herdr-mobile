// Each machine's `herdr-app` document, as desktop's mirror.rs defines it:
// { spaces: [{ id, name, folder, tabs: [{ id, name, root }] }] }. Desktop
// windows share it with versioned writes, the newest accepted write winning;
// the phone writes it the same way. Edits pass every field they don't change
// through untouched (each tab's `root` is desktop's pane tree).

export type Call = (method: string, params: Record<string, unknown>) => Promise<any>;

type Doc = { spaces: any[]; [k: string]: unknown };

const hex = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

/** A tab of one terminal, the tree desktop's adopt() builds for a labeled terminal. */
export function newTab(id: string, name: string, terminal: string) {
  return { id, name, root: { id, type: "row", children: [{ id: `p${hex()}`, type: "block", content: { terminal } }] } };
}

/** Reads, edits and writes the document, retrying when another client wrote first. `edit` returns false to write nothing. */
export async function editDoc(call: Call, edit: (doc: Doc) => boolean | void): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const r = await call("doc.get", { name: "herdr-app" });
    const doc: Doc = r.value && typeof r.value === "object" ? structuredCloneish(r.value) : { spaces: [] };
    if (!Array.isArray(doc.spaces)) doc.spaces = [];
    if (edit(doc) === false) return;
    try {
      await call("doc.set", { name: "herdr-app", version: r.version, value: doc });
      return;
    } catch (e: any) {
      if (attempt >= 2 || e?.kind !== "conflict") throw e;
    }
  }
}

const structuredCloneish = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** A space with this tab, added when the document doesn't have it. */
export function ensureSpace(doc: Doc, space: { id: string; name: string; folder: string }, tab: ReturnType<typeof newTab>) {
  const s = doc.spaces.find((x) => x?.id === space.id);
  if (!s) {
    doc.spaces.push({ ...space, tabs: [tab] });
    return;
  }
  if (space.name && !s.name) s.name = space.name;
  ensureTab(doc, space.id, tab);
}

/** This tab in its space, added when missing; an existing (adopted) tab keeps its tree and gets the name. */
export function ensureTab(doc: Doc, spaceId: string, tab: ReturnType<typeof newTab>) {
  const s = doc.spaces.find((x) => x?.id === spaceId);
  if (!s) return false;
  s.tabs ??= [];
  const t = s.tabs.find((x: any) => x?.id === tab.id);
  if (!t) s.tabs.push(tab);
  else if (tab.name && !t.name) t.name = tab.name;
  return true;
}

export function renameSpace(doc: Doc, id: string, name: string) {
  const s = doc.spaces.find((x) => x?.id === id);
  if (!s) throw new Error(`no space ${id} in this machine's layout yet`);
  s.name = name;
}

export function renameTab(doc: Doc, id: string, name: string) {
  const t = doc.spaces.flatMap((s) => s.tabs ?? []).find((x: any) => x?.id === id);
  if (!t) throw new Error(`no tab ${id} in this machine's layout yet`);
  t.name = name;
}

/** Moves an entry to a position, 1 being first. */
function move<T extends { id?: string }>(list: T[], id: string, index: number) {
  const from = list.findIndex((x) => x?.id === id);
  if (from < 0) throw new Error(`no ${id} in this machine's layout yet`);
  const [item] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(list.length, index - 1)), 0, item);
}

export const moveSpace = (doc: Doc, id: string, index: number) => move(doc.spaces, id, index);

export function moveTab(doc: Doc, id: string, index: number) {
  const s = doc.spaces.find((x) => (x?.tabs ?? []).some((t: any) => t?.id === id));
  if (!s) throw new Error(`no tab ${id} in this machine's layout yet`);
  move(s.tabs, id, index);
}

/** Removes a terminal's pane; a tab left empty goes, and a space left without tabs. Returns whether anything changed. */
export function removeTerminal(doc: Doc, terminal: string): boolean {
  let changed = false;
  const prune = (n: any): any => {
    if (n?.content?.terminal === terminal) {
      changed = true;
      return null;
    }
    if (Array.isArray(n?.children)) {
      n.children = n.children.map(prune).filter(Boolean);
      if (n.children.length === 0 && n.type !== "block") return null;
    }
    return n;
  };
  for (const s of doc.spaces) {
    s.tabs = (s.tabs ?? []).filter((t: any) => {
      const root = prune(t.root);
      if (root) t.root = root;
      return !!root;
    });
  }
  doc.spaces = doc.spaces.filter((s) => (s.tabs ?? []).length > 0);
  return changed;
}

export function removeSpace(doc: Doc, id: string): boolean {
  const before = doc.spaces.length;
  doc.spaces = doc.spaces.filter((s) => s?.id !== id);
  return doc.spaces.length !== before;
}

export function removeTab(doc: Doc, id: string): boolean {
  let changed = false;
  for (const s of doc.spaces) {
    const n = (s.tabs ?? []).length;
    s.tabs = (s.tabs ?? []).filter((t: any) => t?.id !== id);
    changed ||= s.tabs.length !== n;
  }
  doc.spaces = doc.spaces.filter((s) => (s.tabs ?? []).length > 0);
  return changed;
}

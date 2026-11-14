// The one way to change anything: mods (run()), the app's menus and its
// gestures use this table. Names and arguments follow herdr-app desktop's
// commands wherever the idea is the same.
import type { Fleet, Target } from "./hc/fleet";
import { editDoc, ensureSpace, ensureTab, moveSpace, moveTab, newTab, removeSpace, removeTab, removeTerminal, renameSpace, renameTab } from "./hc/herdr-doc";
import type { AppData } from "./mods/data-types";

export type Arg = "required" | "optional";

/** What commands act through; the app supplies navigation, overlays and the clipboard. */
export type CommandContext = {
  fleet: Fleet;
  data(): Pick<AppData, "spaces" | "terminals">;
  nav: {
    openScreen(mod: string, props: Record<string, unknown>, title?: string): void;
    back(): void;
    selectTab(tabs: string, child: string): void;
    showTerminal(terminal: string): void;
    settings(): void;
    machines(): void;
  };
  confirm(title: string, detail: string, command: { name: string; args: Record<string, unknown> }): void;
  clipboard(text: string): Promise<void>;
  /** Sizes a new terminal to the phone before anything draws it. */
  presize(terminal: string): Promise<void>;
  definition: {
    switchLayout(name: string): Promise<void>;
    cloneLayout(name: string, as?: string): Promise<string>;
    cloneMod(name: string, as?: string): Promise<string>;
    resetLayout(name?: string): Promise<void>;
    reload(): Promise<void>;
  };
};

export type Command = {
  name: string;
  args: Record<string, Arg>;
  doc: string;
  run(ctx: CommandContext, args: Record<string, any>): Promise<unknown> | unknown;
};

const id = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

function targetOf(ctx: CommandContext, machine: string): Target {
  const t = ctx.fleet.targets().find((x) => x.label === machine);
  if (!t) throw new Error(`${machine} is not connected (machines: ${ctx.fleet.targets().map((x) => x.label).join(", ") || "none"})`);
  return t;
}

function spaceOf(ctx: CommandContext, spaceId: string) {
  const s = ctx.data().spaces.find((x) => x.id === spaceId);
  if (!s) throw new Error(`no space ${spaceId}`);
  return s;
}

const local = (key: string) => key.slice(key.lastIndexOf(":") + 1).split("/").pop()!;

/** A folder on that machine: ~ and ~/x become absolute there. */
async function folderOn(ctx: CommandContext, target: Target, folder: string | undefined): Promise<string> {
  const r = await ctx.fleet.exec(target, ["sh", "-c", 'case "$1" in "~") cd ;; "~/"*) cd "$HOME/${1#??}" ;; *) cd "$1" ;; esac && pwd -P', "folder", folder ?? "~"]);
  if (r.code !== 0) throw new Error(`no folder ${folder} on ${target.label}: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

async function start(ctx: CommandContext, target: Target, spaceId: string, tabId: string, cwd: string, argv?: string[]): Promise<string> {
  const key = await ctx.fleet.run(target, {
    ...(argv?.length ? { argv } : {}),
    cwd,
    keep: true,
    labels: { "herdr.space": spaceId, "herdr.tab": tabId },
  });
  await ctx.presize(key).catch(() => {});
  return key;
}

const docOf = (ctx: CommandContext, target: Target) => (method: string, params: Record<string, unknown>) => ctx.fleet.call(target, method, params);

function route(ctx: CommandContext, terminal: string) {
  const r = ctx.fleet.route(terminal);
  if (!r) throw new Error(`terminal ${terminal} is not reachable`);
  return r;
}

async function endTerminals(ctx: CommandContext, keys: string[]) {
  await Promise.all(
    keys.map(async (k) => {
      const r = ctx.fleet.route(k);
      if (r && r.session.terminal.state === "live") await r.conn.call("terminal.kill", { terminal: r.address }).catch(() => {});
    }),
  );
}

export const COMMANDS: Command[] = [
  // Navigation
  { name: "screen.open", args: { mod: "required", props: "optional", title: "optional" }, doc: "Push a screen showing a mod (its props, a title; default: its mod.json title).", run: (c, a) => c.nav.openScreen(a.mod, a.props ?? {}, a.title) },
  { name: "screen.back", args: {}, doc: "Go back one screen.", run: (c) => c.nav.back() },
  { name: "layout.select", args: { tabs: "required", child: "required" }, doc: "Show a tab of a layout's tabs node (by their ids).", run: (c, a) => c.nav.selectTab(a.tabs, a.child) },
  { name: "terminal.show", args: { terminal: "required" }, doc: "Open a terminal on the app's terminal screen.", run: (c, a) => c.nav.showTerminal(a.terminal) },
  { name: "app.settings", args: {}, doc: "Open Settings.", run: (c) => c.nav.settings() },
  { name: "app.machines", args: {}, doc: "Open Machines (this phone's SSH links).", run: (c) => c.nav.machines() },

  // Spaces and tabs
  {
    name: "space.new",
    args: { machine: "required", name: "optional", folder: "optional", tab: "optional", argv: "optional" },
    doc: "Make a space on a machine with one tab: a shell, or argv (an agent: [\"pi\"]), started in folder (default: that machine's home). Returns { space, tab, terminal }.",
    async run(c, a) {
      const target = targetOf(c, a.machine);
      const folder = await folderOn(c, target, a.folder);
      const space = `sp${id()}`;
      const tab = `tb${id()}`;
      const terminal = await start(c, target, space, tab, folder, a.argv);
      await editDoc(docOf(c, target), (doc) => ensureSpace(doc, { id: space, name: a.name ?? "", folder }, newTab(tab, a.tab ?? "", local(terminal))));
      return { space, tab, terminal };
    },
  },
  {
    name: "tab.new",
    args: { space: "required", name: "optional", folder: "optional", argv: "optional" },
    doc: "Make a tab in a space: a shell, or argv, in folder (default: the space's folder). Returns { tab, terminal }.",
    async run(c, a) {
      const s = spaceOf(c, a.space);
      const target = targetOf(c, s.machine);
      const folder = a.folder ? await folderOn(c, target, a.folder) : s.folder || (await folderOn(c, target, "~"));
      const tab = `tb${id()}`;
      const terminal = await start(c, target, s.id, tab, folder, a.argv);
      await editDoc(docOf(c, target), (doc) => {
        if (!ensureTab(doc, s.id, newTab(tab, a.name ?? "", local(terminal)))) ensureSpace(doc, { id: s.id, name: "", folder }, newTab(tab, a.name ?? "", local(terminal)));
      });
      return { tab, terminal };
    },
  },
  {
    name: "space.close",
    args: { id: "required", confirmed: "optional" },
    doc: "Close a space and end its terminals (asks first unless confirmed).",
    async run(c, a) {
      const s = spaceOf(c, a.id);
      if (!a.confirmed) return c.confirm(`Close ${s.name}?`, "Its terminals and agents end.", { name: "space.close", args: { id: a.id, confirmed: true } });
      const keys = c.data().terminals.filter((t) => t.space === s.id).map((t) => t.address);
      await endTerminals(c, keys);
      await editDoc(docOf(c, targetOf(c, s.machine)), (doc) => removeSpace(doc, s.id));
    },
  },
  {
    name: "tab.close",
    args: { id: "required", confirmed: "optional" },
    doc: "Close a tab and end its terminals (asks first unless confirmed); a space's last tab closes the space.",
    async run(c, a) {
      const s = c.data().spaces.find((x) => x.tabs.some((t) => t.id === a.id));
      if (!s) throw new Error(`no tab ${a.id}`);
      if (!a.confirmed) return c.confirm("Close this tab?", "Its terminals and agents end.", { name: "tab.close", args: { id: a.id, confirmed: true } });
      const keys = c.data().terminals.filter((t) => t.tab === a.id).map((t) => t.address);
      await endTerminals(c, keys);
      await editDoc(docOf(c, targetOf(c, s.machine)), (doc) => removeTab(doc, a.id));
    },
  },
  {
    name: "space.rename",
    args: { id: "required", name: "required" },
    doc: 'Rename a space ("": called after where its first terminal is again).',
    run: (c, a) => editDoc(docOf(c, targetOf(c, spaceOf(c, a.id).machine)), (doc) => renameSpace(doc, a.id, a.name)),
  },
  {
    name: "tab.rename",
    args: { id: "required", name: "required" },
    doc: 'Rename a tab ("": unnamed again).',
    async run(c, a) {
      const s = c.data().spaces.find((x) => x.tabs.some((t) => t.id === a.id));
      if (!s) throw new Error(`no tab ${a.id}`);
      await editDoc(docOf(c, targetOf(c, s.machine)), (doc) => renameTab(doc, a.id, a.name));
    },
  },
  {
    name: "space.move",
    args: { id: "required", index: "required" },
    doc: "Move a space to a position among its machine's spaces (1 = first).",
    run: (c, a) => editDoc(docOf(c, targetOf(c, spaceOf(c, a.id).machine)), (doc) => moveSpace(doc, a.id, Number(a.index))),
  },
  {
    name: "tab.move",
    args: { id: "required", index: "required" },
    doc: "Move a tab to a position in its space (1 = first).",
    async run(c, a) {
      const s = c.data().spaces.find((x) => x.tabs.some((t) => t.id === a.id));
      if (!s) throw new Error(`no tab ${a.id}`);
      await editDoc(docOf(c, targetOf(c, s.machine)), (doc) => moveTab(doc, a.id, Number(a.index)));
    },
  },

  // Terminals
  { name: "terminal.send", args: { terminal: "required", text: "required" }, doc: "Paste text into a terminal and press Enter.", run: (c, a) => { const r = route(c, a.terminal); return r.conn.call("terminal.send", { terminal: r.address, text: a.text }); } },
  { name: "terminal.interrupt", args: { terminal: "required" }, doc: "Press a terminal's stop key.", run: (c, a) => { const r = route(c, a.terminal); return r.conn.call("terminal.interrupt", { terminal: r.address }); } },
  { name: "terminal.kill", args: { terminal: "required" }, doc: "End a terminal's program.", run: (c, a) => { const r = route(c, a.terminal); return r.conn.call("terminal.kill", { terminal: r.address }); } },
  {
    name: "terminal.close",
    args: { terminal: "required" },
    doc: "End a terminal and remove it: its pane goes, a tab left empty goes, and a space left without tabs.",
    async run(c, a) {
      const t = c.data().terminals.find((x) => x.address === a.terminal);
      await c.fleet.close(a.terminal);
      if (t?.space) {
        const target = c.fleet.targetOf(a.terminal);
        if (target) await editDoc(docOf(c, target), (doc) => removeTerminal(doc, local(a.terminal)));
      }
    },
  },
  {
    name: "terminal.copy",
    args: { terminal: "required" },
    doc: "Copy a terminal's screen and history to the clipboard.",
    async run(c, a) {
      const r = route(c, a.terminal);
      const out = await r.conn.call<{ text?: string }>("terminal.read", { terminal: r.address });
      await c.clipboard((out.text ?? "").replace(/\s+$/, ""));
    },
  },

  // The definition
  { name: "layout.switch", args: { name: "required" }, doc: "Show another layout (settings.json \"layout\").", run: (c, a) => c.definition.switchLayout(a.name) },
  { name: "layout.clone", args: { name: "required", as: "optional" }, doc: "Copy a layout to edit it (default name: <name>-copy), then show it. Returns { name }.", run: async (c, a) => ({ name: await c.definition.cloneLayout(a.name, a.as) }) },
  { name: "mod.clone", args: { name: "required", as: "optional" }, doc: "Copy a mod to edit it (default name: <name>-copy). Returns { name }.", run: async (c, a) => ({ name: await c.definition.cloneMod(a.name, a.as) }) },
  { name: "layout.reset", args: { name: "optional" }, doc: "Put a shipped layout back as shipped (default: the one shown); yours is kept aside as <name>.json.old-<time>.", run: (c, a) => c.definition.resetLayout(a.name) },
  { name: "definition.reload", args: {}, doc: "Read the whole definition again from the definition machine.", run: (c) => c.definition.reload() },

  // Other
  { name: "clipboard.copy", args: { text: "required" }, doc: "Copy text to the clipboard.", run: (c, a) => c.clipboard(String(a.text)) },
];

const BY_NAME = new Map(COMMANDS.map((c) => [c.name, c]));

/** Runs a command by name, checking its arguments the way desktop does. */
export async function runCommand(ctx: CommandContext, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const cmd = BY_NAME.get(name);
  if (!cmd) throw new Error(`unknown command ${name} (see commands())`);
  const valid = Object.keys(cmd.args);
  for (const k of Object.keys(args ?? {})) {
    if (!(k in cmd.args)) throw new Error(`${name}: unknown argument "${k}" (arguments: ${valid.join(", ") || "none"})`);
  }
  for (const [k, v] of Object.entries(cmd.args)) {
    if (v === "required" && (args?.[k] === undefined || args?.[k] === null)) throw new Error(`${name}: needs ${k}`);
  }
  return (await cmd.run(ctx, args ?? {})) ?? null;
}

/** What commands() gives mods. */
export const COMMAND_LIST = COMMANDS.map((c) => ({ name: c.name, args: c.args, doc: c.doc }));

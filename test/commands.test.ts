// Commands against a real scratch core: spaces and tabs made, named, moved
// and closed through the machine's herdr-app document, as desktop reads it.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { runCommand, type CommandContext } from "../src/commands";
import { Fleet, type MachineConfig } from "../src/hc/fleet";
import { editDoc, ensureTab, newTab, renameSpace } from "../src/hc/herdr-doc";
import { fleetData } from "../src/mods/data";
import { hcProcessTransport } from "./node-transport";

const scratch = mkdtempSync(join(tmpdir(), "hm-cmd-"));
const env = { XDG_STATE_HOME: join(scratch, "state"), XDG_RUNTIME_DIR: join(scratch, "run"), XDG_CONFIG_HOME: join(scratch, "config"), HC_SESSION: "hmcmd" };
const M: MachineConfig = { id: "c", name: "c", host: "hmcmd", port: 22, user: "me" };
let fleet: Fleet;
let machine: string;
const confirmed: unknown[] = [];

function until<T>(check: () => T | undefined | false, ms = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const v = check();
      if (v) return resolve(v);
      if (Date.now() - start > ms) return reject(new Error("timed out"));
      setTimeout(tick, 50);
    };
    tick();
  });
}

const data = () => fleetData({ snapshot: fleet.snapshot(), targets: fleet.targets(), definitionLink: "c" });

const ctx = (): CommandContext => ({
  fleet,
  data,
  nav: { openScreen() {}, back() {}, selectTab() {}, showTerminal() {}, settings() {}, machines() {} },
  confirm: (...a) => void confirmed.push(a),
  clipboard: async () => {},
  presize: async () => {},
  definition: { switchLayout: async () => {}, cloneLayout: async () => "", cloneMod: async () => "", resetLayout: async () => {}, reload: async () => {} },
});

const target = () => fleet.targets()[0];
const doc = async () => (await fleet.call(target(), "doc.get", { name: "herdr-app" })).value;

beforeAll(async () => {
  mkdirSync(env.XDG_RUNTIME_DIR, { recursive: true });
  execFileSync("hc", ["server", "start"], { env: { ...process.env, ...env } });
  fleet = new Fleet(async () => hcProcessTransport(env));
  fleet.setMachines([M]);
  await until(() => fleet.snapshot().links[0]?.state === "connected" && fleet.targets().length);
  machine = target().label;
}, 30_000);

afterAll(() => {
  fleet?.stop();
  try {
    execFileSync("hc", ["server", "stop"], { env: { ...process.env, ...env } });
  } catch {}
  rmSync(scratch, { recursive: true, force: true });
});

test("space.new makes a kept, labeled terminal and its document entry", async () => {
  const r: any = await runCommand(ctx(), "space.new", { machine, name: "work", folder: "/tmp", tab: "first", argv: ["cat"] });
  const s = await until(() => data().spaces.find((x) => x.id === r.space && x.named && x.tabs[0]?.terminals.length));
  expect(s).toMatchObject({ name: "work", named: true, machine, folder: "/tmp", tabs: [{ id: r.tab, name: "first", terminals: [r.terminal] }] });
  const term = fleet.snapshot().sessions.find((x) => x.key === r.terminal)!.terminal;
  expect(term.keep).toBe(true);
  expect(term.labels).toMatchObject({ "herdr.space": r.space, "herdr.tab": r.tab });
  const entry = (await doc()).spaces.find((x: any) => x.id === r.space);
  expect(entry.tabs[0].root).toMatchObject({ id: r.tab, type: "row", children: [{ type: "block", content: { terminal: term.address } }] });
  expect(entry.tabs[0].root.children[0].id).toMatch(/^p[0-9a-f]{32}$/);
}, 30_000);

test("an unnamed space is called after its folder; tab.new, rename and move", async () => {
  const a: any = await runCommand(ctx(), "space.new", { machine, folder: "/tmp", argv: ["cat"] });
  await until(() => data().spaces.find((x) => x.id === a.space)?.name === "tmp");
  const t: any = await runCommand(ctx(), "tab.new", { space: a.space, argv: ["cat"], name: "second" });
  await until(() => data().spaces.find((x) => x.id === a.space)?.tabs.some((x) => x.id === t.tab && x.name === "second"));
  await runCommand(ctx(), "space.rename", { id: a.space, name: "renamed" });
  await until(() => data().spaces.find((x) => x.id === a.space)?.name === "renamed");
  await runCommand(ctx(), "space.move", { id: a.space, index: 1 });
  await until(() => data().spaces[0]?.id === a.space);
  await runCommand(ctx(), "tab.move", { id: t.tab, index: 1 });
  await until(() => data().spaces.find((x) => x.id === a.space)?.tabs[0].id === t.tab);
}, 30_000);

test("closing a terminal removes its pane, its empty tab, and its empty space", async () => {
  const a: any = await runCommand(ctx(), "space.new", { machine, folder: "/tmp", argv: ["cat"] });
  await until(() => data().spaces.find((x) => x.id === a.space));
  await runCommand(ctx(), "terminal.close", { terminal: a.terminal });
  await until(() => !data().spaces.find((x) => x.id === a.space));
  expect((await doc()).spaces.find((x: any) => x.id === a.space)).toBeUndefined();
}, 30_000);

test("space.close asks first, then ends its terminals", async () => {
  const a: any = await runCommand(ctx(), "space.new", { machine, folder: "/tmp", argv: ["cat"] });
  await until(() => data().spaces.find((x) => x.id === a.space));
  await runCommand(ctx(), "space.close", { id: a.space });
  expect(confirmed.at(-1)).toEqual([expect.stringContaining("Close"), expect.any(String), { name: "space.close", args: { id: a.space, confirmed: true } }]);
  await runCommand(ctx(), "space.close", { id: a.space, confirmed: true });
  await until(() => fleet.snapshot().sessions.find((x) => x.key === a.terminal)?.terminal.state === "finished");
  await until(() => !data().spaces.find((x) => x.id === a.space));
}, 30_000);

test("a write that loses the race is retried on the newer document", async () => {
  const a: any = await runCommand(ctx(), "space.new", { machine, folder: "/tmp", argv: ["cat"] });
  let raced = false;
  const call = async (method: string, params: Record<string, unknown>) => {
    if (method === "doc.set" && !raced) {
      raced = true;
      // Another client writes first.
      await editDoc((m, p) => fleet.call(target(), m, p), (d) => renameSpace(d, a.space, "theirs"));
    }
    return fleet.call(target(), method, params);
  };
  await editDoc(call, (d) => ensureTab(d, a.space, newTab("tbmine", "mine", "t999")));
  const entry = (await doc()).spaces.find((x: any) => x.id === a.space);
  expect(entry.name).toBe("theirs");
  expect(entry.tabs.map((t: any) => t.id)).toContain("tbmine");
}, 30_000);

test("edits keep what desktop wrote: nested splits and fields the phone doesn't know", async () => {
  const { version } = await fleet.call(target(), "doc.get", { name: "herdr-app" });
  const desktop = {
    spaces: [{ id: "spdesk", name: "", folder: "/srv", future: { x: 1 }, tabs: [{ id: "tbdesk", name: "", root: { id: "tbdesk", type: "row", children: [
      { id: "p1", type: "block", content: { terminal: "t1" }, size: { weight: 2 } },
      { id: "c1", type: "column", children: [{ id: "p2", type: "block", content: { terminal: "t2" } }, { id: "p3", type: "block", content: { mod: "files", props: { file: "a" } } }] },
    ] } }] }],
  };
  await fleet.call(target(), "doc.set", { name: "herdr-app", version, value: desktop });
  await editDoc((m, p) => fleet.call(target(), m, p), (d) => renameSpace(d, "spdesk", "named"));
  const after = (await doc()).spaces[0];
  expect(after).toEqual({ ...desktop.spaces[0], name: "named" });
}, 30_000);

test("unknown arguments and missing ones are errors that say what's valid", async () => {
  await expect(runCommand(ctx(), "space.new", { machine, space: "x" })).rejects.toThrow('space.new: unknown argument "space" (arguments: machine, name, folder, tab, argv)');
  await expect(runCommand(ctx(), "space.rename", { id: "x" })).rejects.toThrow("space.rename: needs name");
  await expect(runCommand(ctx(), "nope")).rejects.toThrow("unknown command nope");
});

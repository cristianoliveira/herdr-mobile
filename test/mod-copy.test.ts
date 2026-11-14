// A mod copy end to end: the real runtime (src/mods/runtime) in the
// WebAssembly engine, driven the way the app drives it.
import { expect, test } from "vitest";
import { ModCopy, type CopyHost, type CopyState, type ModData } from "../src/mods/copy";
import type { UIElement, UINode } from "../src/mods/description";
import type { EngineFactory, OutboxMessage } from "../src/mods/engine";
import { wasmEngine } from "../src/mods/engine-wasm";
import { RUNTIME_FILES } from "../src/mods/runtime.generated";

function until<T>(check: () => T | undefined | false | null, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const v = check();
      if (v) return resolve(v);
      if (Date.now() - start > ms) return reject(new Error("timed out"));
      setTimeout(tick, 5);
    };
    tick();
  });
}

/** All the text in a description, in order. */
const text = (n: UINode | null | undefined): string => (n == null ? "" : typeof n === "string" ? n : (n.k ?? []).map(text).join(" "));

/** The first element whose text includes `s` and has a handler. */
function find(n: UINode | null, s: string, handler: "click" | "long_press" = "click"): UIElement | null {
  if (!n || typeof n === "string") return null;
  for (const c of n.k ?? []) {
    const f = find(c, s, handler);
    if (f) return f;
  }
  return n.on?.[handler] !== undefined && text(n).includes(s) ? n : null;
}

function setup(main: string, opts: { data?: ModData; calls?: Record<string, (...a: any[]) => unknown>; engine?: EngineFactory } = {}) {
  let data: ModData = { props: { who: "world" }, ...opts.data };
  const posted: OutboxMessage[] = [];
  const states: CopyState[] = [];
  const host: CopyHost = {
    engine: opts.engine ?? wasmEngine,
    runtime: RUNTIME_FILES,
    call: async (name, args) => {
      const f = opts.calls?.[name];
      if (!f) throw new Error(`no host call ${name}`);
      return f(...args);
    },
    post: (m) => void posted.push(m),
  };
  const storage: Record<string, string> = {};
  const copy = new ModCopy("test", host, () => data, storage, (s) => void states.push(s));
  return {
    copy,
    posted,
    storage,
    start: (files: Record<string, string> = {}) => copy.load({ "main.js": main, ...files }),
    setData(patch: ModData) {
      data = { ...data, ...patch };
      copy.dataChanged();
    },
    get text() {
      return text(copy.current.description);
    },
  };
}

const COUNTER = `
import { View, div, h_flex } from "herdr-ui";
import { props, spaces } from "herdr";
export default class Counter extends View {
  init(p) { this.n = 0; this.who = p.who; }
  render(cx) {
    return h_flex().gap(4).bg("#000").child(\`hello \${this.who}\`)
      .child(div().id("plus").on_click((_e, cx) => { this.n++; cx.notify(); }).child(\`count \${this.n}\`))
      .child(\`spaces \${spaces().length}\`);
  }
}
`;

test("a mod draws from its props and the app's data", async () => {
  const m = setup(COUNTER, { data: { spaces: [{ id: "a" }, { id: "b" }] } });
  expect(await m.start()).toBe(true);
  expect(m.text).toBe("hello world count 0 spaces 2");
  const root = m.copy.current.description as UIElement;
  expect(root).toMatchObject({ t: "b", s: { flexDirection: "row", gap: 4, backgroundColor: "#000" } });
  expect(find(root, "count")).toMatchObject({ key: "plus" });
});

test("a tap runs the mod's callback and draws again", async () => {
  const m = setup(COUNTER);
  await m.start();
  m.copy.event(find(m.copy.current.description, "count")!.on!.click!);
  await until(() => m.text.includes("count 1"));
});

test("new data draws again, sending only what changed", async () => {
  const sent: unknown[] = [];
  const spy: EngineFactory = async (o) => {
    const e = await wasmEngine(o);
    return { ...e, call: (name, args) => (name === "render" && sent.push(args?.[0]), e.call(name, args)) };
  };
  const m = setup(COUNTER, { engine: spy, data: { spaces: [], agents: [] } });
  await m.start();
  m.setData({ spaces: [{ id: "x" }] });
  await until(() => m.text.includes("spaces 1"));
  expect(sent.at(-1)).toEqual({ spaces: [{ id: "x" }] });
});

test("a mod waits for the app: exec resolves, a failure rejects", async () => {
  const m = setup(
    `
import { View, div } from "herdr-ui";
import { exec } from "herdr";
export default class E extends View {
  init(_p, cx) {
    this.out = "…";
    cx.spawn(async (cx) => {
      const r = await exec("uptime", ["-p"], { on: "mini" });
      try { await exec("nope"); } catch (e) { this.err = e.message; }
      this.out = r.stdout; cx.notify();
    });
  }
  render() { return div().child(this.out).child(this.err ?? ""); }
}`,
    { calls: { exec: (cmd: string, args: string[], o: any) => (cmd === "uptime" ? { code: 0, stdout: `up ${args[0]} on ${o.on}`, stderr: "" } : Promise.reject(new Error("not found"))) } },
  );
  await m.start();
  await until(() => m.text === "up -p on mini not found");
});

test("timers fire through cx, and setTimeout says what to use instead", async () => {
  const m = setup(`
import { View, div } from "herdr-ui";
export default class T extends View {
  init(_p, cx) {
    this.ticks = 0;
    try { setTimeout(() => {}, 1); } catch (e) { this.why = e.message; }
    const id = cx.timer.every(10, (cx) => { this.ticks++; if (this.ticks === 3) cx.timer.cancel(id); cx.notify(); });
  }
  render() { return div().child(String(this.ticks)).child(this.why); }
}`);
  await m.start();
  await until(() => m.text.startsWith("3 "));
  expect(m.text).toContain("cx.timer.after");
  await new Promise((r) => setTimeout(r, 60));
  expect(m.text.startsWith("3 ")).toBe(true);
});

test("storage, shared state, overlays and logs reach the app", async () => {
  const m = setup(`
import { View, div } from "herdr-ui";
import { setShared, shared, openOverlay, notify } from "herdr";
export default class S extends View {
  init() {
    localStorage.setItem("pins", "[1]");
    setShared("space.colors", { a: "ansi6" });
    this.overlay = openOverlay({ mod: "menu", props: { at: 1 } });
    notify({ title: "hi" });
    console.log("ready", { n: 1 });
  }
  render() { return div().child(localStorage.getItem("pins")).child(JSON.stringify(shared("space.colors"))); }
}`);
  await m.start();
  expect(m.text).toBe('[1] {"a":"ansi6"}');
  expect(m.storage).toEqual({ pins: "[1]" });
  expect(m.posted).toEqual(
    expect.arrayContaining([
      { t: "storage", key: "pins", value: "[1]" },
      { t: "shared", key: "space.colors", value: { a: "ansi6" } },
      expect.objectContaining({ t: "overlay", mod: "menu", props: { at: 1 }, kind: "sheet" }),
      expect.objectContaining({ t: "toast", title: "hi" }),
      { t: "log", level: "log", text: 'ready {"n":1}' },
    ]),
  );
});

test("a broken reload keeps the last good build running, with the error", async () => {
  const m = setup(COUNTER);
  await m.start();
  expect(await m.start({ "main.js": "export default class {\n render() {\n return div(\n }\n}" })).toBe(false);
  expect(m.text).toBe("hello world count 0 spaces 0");
  expect(m.copy.current.error).toMatchObject({ name: "SyntaxError", file: "main.js", line: 4 });
  // The old build still answers taps.
  m.copy.event(find(m.copy.current.description, "count")!.on!.click!);
  await until(() => m.text.includes("count 1"));
});

test("a good reload replaces the build and clears the error", async () => {
  const m = setup(COUNTER);
  await m.start();
  await m.start({ "main.js": "oops(" });
  expect(await m.start({ "main.js": COUNTER.replace("hello", "hi") })).toBe(true);
  expect(m.text).toBe("hi world count 0 spaces 0");
  expect(m.copy.current.error).toBeNull();
});

test("a render that throws keeps the last description and names where", async () => {
  const m = setup(`
import { View, div } from "herdr-ui";
import { spaces } from "herdr";
export default class B extends View {
  render() {
    if (spaces().length) throw new Error("no spaces please");
    return div().child("fine");
  }
}`);
  await m.start();
  m.setData({ spaces: [1] });
  await until(() => m.copy.current.error);
  expect(m.text).toBe("fine");
  expect(m.copy.current.error).toMatchObject({ message: "no spaces please", file: "main.js", line: 6 });
});

test("a runaway tap is stopped and the mod keeps working", async () => {
  const m = setup(`
import { View, div } from "herdr-ui";
export default class R extends View {
  init() { this.n = 0; }
  render() {
    return div().child(div().on_click(() => { for (;;) {} }).child("hang"))
      .child(div().on_click((_e, cx) => { this.n++; cx.notify(); }).child(\`n \${this.n}\`));
  }
}`);
  await m.start();
  const start = Date.now();
  m.copy.event(find(m.copy.current.description, "hang")!.on!.click!);
  await until(() => m.copy.current.error?.message.includes("interrupted"));
  expect(Date.now() - start).toBeLessThan(1500);
  m.copy.event(find(m.copy.current.description, "n 0")!.on!.click!);
  await until(() => m.text.includes("n 1"));
});

test("render must return an element", async () => {
  const m = setup(`import { View, div } from "herdr-ui"; export default class A extends View { render() { return [div()]; } }`);
  expect(await m.start()).toBe(false);
  expect(m.copy.current.error?.message).toContain("return one element from herdr-ui");
});

test("a builder method that doesn't exist names itself; .h() and .w() aren't shadowed", async () => {
  const m = setup(`import { View, div } from "herdr-ui"; export default class A extends View { render() { return div().h(10).w(20).hover(() => {}); } }`);
  expect(await m.start()).toBe(false);
  expect(m.copy.current.error?.message).toBe("herdr-ui elements have no .hover() (see herdr-ui.d.ts)");
});

test("a copy that closes itself still finishes what it was waiting for", async () => {
  const calls: string[] = [];
  const m = setup(
    `
import { View, div } from "herdr-ui";
import { run } from "herdr";
export default class P extends View {
  render() {
    return div().on_click(() => { run("space.new", {}).then((r) => run("terminal.show", { terminal: r.terminal })); }).child("save");
  }
}`,
    { calls: { run: async (name: string) => (calls.push(name), await new Promise((r) => setTimeout(r, 100)), { terminal: "t1" }) } },
  );
  await m.start();
  m.copy.event(find(m.copy.current.description, "save")!.on!.click!);
  await new Promise((r) => setTimeout(r, 20));
  await m.copy.close();
  expect(calls).toEqual(["space.new", "terminal.show"]);
});

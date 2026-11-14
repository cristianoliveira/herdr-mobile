// herdr: what the app tells a mod and what a mod asks of the app.
// Calls the app answers later are promises; everything else is synchronous.
import { El } from "herdr-ui";

let data = {
  spaces: [], agents: [], terminals: [], machines: [], settings: {}, theme: {},
  safeArea: { top: 0, bottom: 0, left: 0, right: 0 }, shared: {}, props: {}, commands: [], layout: null,
};
let outbox = [];
let next = 1;
let callbacks = [];
let storage = {};
const pending = new Map();
const timers = new Map();

const post = (msg) => { outbox.push(msg); };

function describe(e) {
  if (e instanceof Error) return { message: e.message, name: e.name, stack: e.stack };
  return { message: String(e) };
}
function report(e) { post({ t: "error", error: describe(e) }); }

function ask(name, args) {
  const id = next++;
  post({ t: "call", id, name, args });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

// Live data, from the app's last snapshot.
export const spaces = () => data.spaces;
export const agents = () => data.agents;
export const terminals = () => data.terminals;
export const machines = () => data.machines;
export const settings = () => data.settings;
export const theme = () => data.theme;
export const safeArea = () => data.safeArea;
export const layout = () => data.layout;
export const commands = () => data.commands;
export const props = () => data.props;

// State shared by every mod on this phone.
export const shared = (key) => data.shared[key];
export function setShared(key, value) {
  data.shared = { ...data.shared, [key]: value };
  post({ t: "shared", key, value: value === undefined ? null : value });
}

// Acting
export const run = (command, args = {}) => ask("run", [command, args]);
export const exec = (cmd, args = [], options = {}) => ask("exec", [cmd, args, options]);
export const readTextFile = (path, options = {}) => ask("readTextFile", [path, options]);
export const writeTextFile = (path, text, options = {}) => ask("writeTextFile", [path, text, options]);
export const knownAgents = (options = {}) => ask("knownAgents", [options]);

// Overlays and notifications
export function openOverlay(options) {
  if (!options?.mod) throw new TypeError("openOverlay needs { mod }");
  const id = `ov${next++}`;
  post({ t: "overlay", id, mod: options.mod, props: options.props ?? {}, kind: options.kind ?? "sheet", title: options.title ?? null });
  return id;
}
export const closeOverlay = (id) => post({ t: "closeOverlay", id: id ?? null });
export const notify = (options) => post({ t: "toast", title: options?.title ?? "", body: options?.body ?? "", level: options?.level ?? "info", action: options?.action ?? null, timeout: options?.timeout ?? null });

// Globals a mod expects
const text = (args) => args.map((a) => (typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(" ");
globalThis.console = {
  log: (...a) => post({ t: "log", level: "log", text: text(a) }),
  info: (...a) => post({ t: "log", level: "log", text: text(a) }),
  warn: (...a) => post({ t: "log", level: "warn", text: text(a) }),
  error: (...a) => post({ t: "log", level: "error", text: text(a) }),
};
globalThis.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem(k, v) { storage[k] = String(v); post({ t: "storage", key: String(k), value: String(v) }); },
  removeItem(k) { delete storage[k]; post({ t: "storage", key: String(k), value: null }); },
};
globalThis.fetch = async (url, init = {}) => {
  const r = await ask("fetch", [String(url), { method: init.method, headers: init.headers, body: init.body }]);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: r.headers, text: async () => r.body, json: async () => JSON.parse(r.body) };
};
const noTimers = () => { throw new Error("mods have no setTimeout or setInterval: use cx.timer.after(ms, fn) or cx.timer.every(ms, fn)"); };
globalThis.setTimeout = noTimers;
globalThis.setInterval = noTimers;

function timer(ms, fn, repeat) {
  if (typeof fn !== "function") throw new TypeError("a timer needs a function");
  const id = next++;
  timers.set(id, { fn, repeat });
  post({ t: "timer", id, ms: Math.max(0, Number(ms) || 0), repeat });
  return id;
}

// One cx for every callback. Desktop's rule still holds: don't keep it.
const cx = {
  notify() { post({ t: "render" }); },
  spawn(fn) { Promise.resolve().then(() => fn(cx)).catch(report); },
  timer: {
    every: (ms, fn) => timer(ms, fn, true),
    after: (ms, fn) => timer(ms, fn, false),
    cancel(id) { if (timers.delete(id)) post({ t: "timerCancel", id }); },
  },
  stop_propagation() {},
};

function serialize(el) {
  if (el === null || el === undefined || el === false || el === true) return null;
  if (typeof el === "string" || typeof el === "number") return String(el);
  if (!(el instanceof El)) throw new TypeError(`render returned ${Array.isArray(el) ? "an array" : typeof el}: return one element from herdr-ui`);
  const n = { t: el._t };
  if (el._style) n.s = el._style;
  if (el._extra) Object.assign(n, el._extra);
  if (el._handlers) {
    n.on = {};
    for (const k in el._handlers) n.on[k] = callbacks.push(el._handlers[k]) - 1;
  }
  if (el._swipe) n.swipe = el._swipe.map((s) => ({ d: s.direction, label: s.label, color: s.color, a: callbacks.push(s.action) - 1 }));
  if (el._kids) {
    const kids = [];
    for (const c of el._kids) {
      const v = Array.isArray(c) ? c.map(serialize) : [serialize(c)];
      for (const x of v) if (x !== null) kids.push(x);
    }
    if (kids.length) n.k = kids;
  }
  return n;
}

let view = null;

/** Called by the boot module with the mod's default export. */
export function __install(Mod) {
  if (typeof Mod !== "function") throw new TypeError("main.js must default-export a class extending View");
  globalThis.__drain = () => { const o = JSON.stringify(outbox); outbox = []; return o; };
  globalThis.__dispatch = (name, json) => {
    const a = JSON.parse(json);
    switch (name) {
      case "init": {
        data = { ...data, ...a[0] };
        storage = a[1] ?? {};
        view = new Mod();
        view.init?.(data.props, cx);
        return "null";
      }
      case "render": {
        if (a[0]) data = { ...data, ...a[0] };
        callbacks = [];
        return JSON.stringify(serialize(view.render(cx)));
      }
      case "event": {
        const fn = callbacks[a[0]];
        if (fn) fn(a[1] ?? {}, cx);
        return "null";
      }
      case "resolve": {
        const [id, ok, value] = a;
        const p = pending.get(id);
        pending.delete(id);
        if (p) ok ? p.resolve(value) : p.reject(new Error(value));
        return "null";
      }
      case "timer": {
        const t = timers.get(a[0]);
        if (t) {
          if (!t.repeat) timers.delete(a[0]);
          t.fn(cx);
        }
        return "null";
      }
      case "close": {
        if (view?.close) Promise.resolve().then(() => view.close(cx)).catch(report);
        return "null";
      }
      default:
        throw new Error(`unknown call ${name}`);
    }
  };
}

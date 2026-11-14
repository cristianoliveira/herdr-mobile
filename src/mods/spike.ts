// Phase 1 spike: the smallest mod runtime and a test mod, to measure the native
// engine on a phone. Phase 2 replaces this with the real runtime.

const HERDR_UI = `
class El {
  constructor(dir) { this.dir = dir; this.style = {}; this.kids = []; this.click = null; }
  gap(n) { this.style.gap = n; return this; }
  p(n) { this.style.padding = n; return this; }
  px(n) { this.style.paddingHorizontal = n; return this; }
  py(n) { this.style.paddingVertical = n; return this; }
  bg(c) { this.style.backgroundColor = c; return this; }
  rounded(n) { this.style.borderRadius = n; return this; }
  text_color(c) { this.style.color = c; return this; }
  text_size(n) { this.style.fontSize = n; return this; }
  font_semibold() { this.style.fontWeight = "600"; return this; }
  flex_1() { this.style.flex = 1; return this; }
  items_center() { this.style.alignItems = "center"; return this; }
  justify_between() { this.style.justifyContent = "space-between"; return this; }
  child(c) { this.kids.push(c); return this; }
  children(cs) { for (const c of cs) this.kids.push(c); return this; }
  when(cond, f) { return cond ? f(this) : this; }
  on_click(f) { this.click = f; return this; }
}
export const div = () => new El("column");
export const v_flex = () => new El("column");
export const h_flex = () => new El("row");
export class View {}
`;

const HERDR = `
let data = {}, outbox = [], callbacks = [], view = null;
export const spaces = () => data.spaces ?? [];
export const theme = () => data.theme ?? {};

function serialize(el) {
  if (el === null || el === undefined || el === false) return null;
  if (typeof el !== "object") return { t: "text", text: String(el) };
  const node = { t: "box", dir: el.dir, style: el.style, children: el.kids.map(serialize).filter(Boolean) };
  if (el.click) node.click = callbacks.push(el.click) - 1;
  return node;
}

const cx = { notify() { outbox.push({ name: "notify" }); } };

export function install(V) {
  view = new V();
  globalThis.__dispatch = (name, args) => {
    const a = JSON.parse(args);
    if (name === "init") { view.init?.(a[0], cx); return "null"; }
    if (name === "data") { data = a[0]; return "null"; }
    if (name === "render") { callbacks = []; return JSON.stringify(serialize(view.render(cx))); }
    if (name === "event") { callbacks[a[0]]?.(a[1], cx); return "null"; }
    if (name === "spin") { for (;;) {} }
    throw new Error("unknown call " + name);
  };
  globalThis.__drain = () => { const o = JSON.stringify(outbox); outbox = []; return o; };
}
`;

const MAIN = `
import { View, div, h_flex, v_flex } from "herdr-ui";
import { spaces, theme } from "herdr";
import { statusColor } from "./status.js";

export default class Spike extends View {
  init(_props, cx) { this.open = null; }
  row(a, t) {
    const on = this.open === a.address;
    return h_flex().px(12).py(8).gap(10).items_center().rounded(8)
      .when(on, (el) => el.bg(t.selected))
      .on_click((_e, cx) => { this.open = on ? null : a.address; cx.notify(); })
      .child(div().text_color(statusColor(a.status, t)).child("●"))
      .child(div().flex_1().text_color(t.foreground).child(a.title))
      .child(div().text_color(t.muted).text_size(12).child(a.status));
  }
  render(cx) {
    const t = theme();
    return v_flex().gap(4).p(8).children(spaces().map((s) =>
      v_flex().gap(2)
        .child(div().px(8).py(4).text_color(t.muted).text_size(12).font_semibold().child(s.name))
        .children(s.agents.map((a) => this.row(a, t)))));
  }
}
`;

const STATUS = `
export function statusColor(status, t) {
  return status === "blocked" ? t.blocked : status === "working" ? t.working : status === "done" ? t.done : t.muted;
}
`;

export const SPIKE_FILES: Record<string, string> = {
  "herdr-ui": HERDR_UI,
  herdr: HERDR,
  "main.js": MAIN,
  "status.js": STATUS,
  "__boot.js": `import Main from "./main.js"; import { install } from "herdr"; install(Main);`,
};

const STATES = ["blocked", "working", "done", "idle", "working"];

export function spikeData(tick = 0) {
  return {
    theme: { foreground: "#e6edf3", muted: "#8b949e", selected: "#1f6feb33", blocked: "#f85149", working: "#d29922", done: "#3fb950" },
    spaces: Array.from({ length: 10 }, (_, i) => ({
      name: `space ${i + 1}`,
      agents: Array.from({ length: 5 }, (_, j) => ({
        address: `t${i}-${j}`,
        title: `agent ${j + 1} in space ${i + 1}`,
        status: STATES[(i + j + tick) % STATES.length],
      })),
    })),
  };
}

export const PI_SVG = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 800 800\">\n  <path fill=\"#fff\" fill-rule=\"evenodd\" d=\"\n    M165.29 165.29\n    H517.36\n    V400\n    H400\n    V517.36\n    H282.65\n    V634.72\n    H165.29\n    Z\n    M282.65 282.65\n    V400\n    H400\n    V282.65\n    Z\n  \"/>\n  <path fill=\"#fff\" d=\"M517.36 400 H634.72 V634.72 H517.36 Z\"/>\n</svg>\n";
export const BRANCH_SVG = "<svg\n  class=\"lucide lucide-git-branch\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M15 6a9 9 0 0 0-9 9V3\" />\n  <circle cx=\"18\" cy=\"6\" r=\"3\" />\n  <circle cx=\"6\" cy=\"18\" r=\"3\" />\n</svg>\n";

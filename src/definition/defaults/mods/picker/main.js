// Go to a tab, space or agent, ported from herdr-app's picker. What needs
// you comes first; type to filter. The last rows start a new space on each
// connected machine.

import { View, div, h_flex, v_flex, svg, image, input } from "herdr-ui";
import { spaces, agents, terminals, machines, run, openOverlay, closeOverlay, theme, props } from "herdr";

const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };

export default class Picker extends View {
  init() {
    this.filter = "";
  }

  go(f) {
    closeOverlay(props().overlay);
    f();
  }

  render() {
    const t = theme();
    const q = this.filter.trim().toLowerCase();
    const hit = (...texts) => !q || texts.some((x) => (x ?? "").toLowerCase().includes(q));
    const icon = (p) => (p?.icon ? (p.tint ? svg(p.icon).size(20).text_color(t.foreground) : image(p.icon).size(20)) : div().size(20));
    const row = (id, left, title, detail, color, action) => h_flex().id(id).min_h(52).py(6).px(16).gap(12).items_center().rounded(10).on_click(action)
      .child(left)
      .child(v_flex().flex_1().min_w(0)
        .child(div().truncate().text_size(16).text_color(t.foreground).child(title))
        .when(Boolean(detail), (el) => el.child(div().truncate().text_size(13).text_color(color ?? t.muted).child(detail))));

    const found = agents()
      .filter((a) => hit(a.space_name, a.title, a.message, a.program.name, a.machine))
      .sort((x, y) => (RANK[y.status] ?? 0) - (RANK[x.status] ?? 0));
    const agentRows = found.map((a) => row(`a-${a.address}`, icon(a.program), `${a.space_name || a.machine} \u00b7 ${a.program.name}`, a.message || a.status, a.status === "blocked" ? t.blocked : null,
      () => this.go(() => run("terminal.show", { terminal: a.address }))));
    const spaceRows = spaces()
      .filter((s) => hit(s.name, s.machine, s.folder))
      .sort((x, y) => (RANK[y.status] ?? 0) - (RANK[x.status] ?? 0))
      .map((s) => row(`s-${s.id}`, svg("icons/ui/layers.svg").size(20).text_color(t.muted), s.name, `${s.machine} \u00b7 ${s.tabs.length} tab${s.tabs.length === 1 ? "" : "s"}`, null,
        () => this.go(() => run("screen.open", { mod: "space", props: { space: s.id }, title: s.name }))));
    const newRows = machines().filter((m) => m.state === "connected" && hit("new space", m.name))
      .map((m) => row(`new-${m.name}`, svg("icons/ui/plus.svg").size(20).text_color(t.muted), `New space on ${m.name}`, null, null,
        () => this.go(() => openOverlay({ mod: "new-menu", kind: "sheet", props: { machine: m.name } }))));
    const section = (text) => div().px(16).pt(12).pb(4).text_size(13).text_color(t.dim).child(text);

    return v_flex().w_full().h(560).pb(8)
      .child(input("filter").placeholder("Go to an agent or space\u2026").autofocus().mx(16).mb(8).px(12).py(10).rounded(10).border(1).border_color(t.input).bg(t.background).text_size(16).text_color(t.foreground)
        .on_change((e, cx) => { this.filter = e.text; cx.notify(); }))
      .child(v_flex().flex_1().overflow_y_scroll()
        .when(agentRows.length > 0, (el) => el.child(section("Agents")).children(agentRows))
        .when(spaceRows.length > 0, (el) => el.child(section("Spaces")).children(spaceRows))
        .children(newRows)
        .when(!agentRows.length && !spaceRows.length && !newRows.length, (el) => el.child(div().p(16).text_color(t.muted).child("Nothing matches."))));
  }
}

// A space's screen, ported from herdr-app's tab bar and tab area: each tab
// with its program and status, its terminals under it, and the sub-agents
// they started. Tap to open a terminal; long press for the tab's menu; swipe
// right to close it. props: { space }.

import { View, div, h_flex, v_flex, svg, image } from "herdr-ui";
import { spaces, terminals, run, openOverlay, theme, props } from "herdr";

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).text_color(color) : image(p.icon).size(size);
}

function mark(t, status) {
  if (status === "working") return svg("icons/ui/spinner.svg").size(16).text_color(t.working).spin(900);
  if (status === "blocked") return div().px(8).py(2).rounded(6).bg(t.blocked + "26").text_size(12).font_semibold().text_color(t.blocked).child("Needs you");
  if (status === "done") return div().size(9).rounded_full().bg(t.done);
  if (status === "idle") return div().size(9).rounded_full().border(1.5).border_color(t.idle);
  return null;
}

export default class Space extends View {
  // A terminal and the sub-agents it started, depth first.
  tree(all, addr, depth) {
    return all.filter((k) => k.parent === addr && k.state === "live").flatMap((k) => [{ term: k, depth }, ...this.tree(all, k.address, depth + 1)]);
  }

  terminalRow(term, depth, t, tab) {
    const name = term.name || term.title || term.program.name;
    return h_flex().id(`term-${term.address}`).min_h(48).py(8).pr(16).pl(16 + depth * 20).gap(12).items_center()
      .on_click(() => run("terminal.show", { terminal: term.address }))
      .on_long_press(() => openOverlay({ mod: "menu", kind: "sheet", props: { target: "agent", terminal: term.address } }))
      .child(icon(term.program, 20, t.foreground) ?? div().size(20))
      .child(v_flex().flex_1().min_w(0)
        .child(div().truncate().text_size(15).text_color(term.state === "live" ? t.foreground : t.dim).child(name))
        .when(Boolean(term.message), (el) => el.child(div().truncate().text_size(13).text_color(term.status === "blocked" ? t.blocked : t.muted).child(term.message))))
      .child(mark(t, term.status) ?? div());
  }

  tabRow(tab, i, t, all) {
    const terms = tab.terminals.map((a) => all.find((x) => x.address === a)).filter(Boolean);
    const lead = terms.find((x) => x.program.agent) ?? terms[0];
    // An unnamed tab is called after its program, as desktop's tab bar does.
    const title = tab.named ? tab.name : lead ? lead.program.name : `Tab ${i + 1}`;
    const head = h_flex().id(`tab-${tab.id}`).min_h(56).px(16).gap(12).items_center().bg(t.surface).rounded(12)
      .on_click(() => lead && run("terminal.show", { terminal: lead.address }))
      .on_long_press(() => openOverlay({ mod: "menu", kind: "sheet", props: { target: "tab", id: tab.id } }))
      .swipe("right", { label: "Close", color: t.blocked, action: () => run("tab.close", { id: tab.id }) })
      .child(icon(lead?.program, 22, t.foreground) ?? svg("icons/ui/terminal.svg").size(22).text_color(t.muted))
      .child(v_flex().flex_1().min_w(0)
        .child(div().truncate().text_size(16).font_medium().text_color(t.foreground).child(title))
        .when(Boolean(lead?.message), (el) => el.child(div().truncate().text_size(13).text_color(lead.status === "blocked" ? t.blocked : t.muted).child(lead.message))))
      .child(mark(t, tab.status) ?? div());
    const subs = terms.length > 1 ? terms : [];
    const kids = terms.flatMap((term) => this.tree(all, term.address, 1));
    return v_flex().gap(2)
      .child(head)
      .children(subs.map((term) => this.terminalRow(term, 1, t, tab)))
      .children(kids.map(({ term, depth }) => this.terminalRow(term, depth, t, tab)));
  }

  render() {
    const t = theme();
    const s = spaces().find((x) => x.id === props().space);
    if (!s) {
      return v_flex().size_full().bg(t.background).p(24).gap(16)
        .child(div().text_size(16).text_color(t.muted).child("This space is gone."))
        .child(div().id("back").p(12).rounded(10).bg(t.raised).on_click(() => run("screen.back")).child("Back"));
    }
    const all = terminals();
    const button = (id, iconPath, label, action) => h_flex().id(id).flex_1().h(44).gap(8).items_center().justify_center().rounded(10).bg(t.raised)
      .on_click(action).child(svg(iconPath).size(18).text_color(t.foreground)).child(div().text_size(14).text_color(t.foreground).child(label));
    return v_flex().size_full().bg(t.background)
      .child(h_flex().px(16).pt(12).pb(8).gap(8)
        .child(button("new", "icons/ui/plus.svg", "New", () => openOverlay({ mod: "new-menu", kind: "sheet", props: { space: s.id } })))
        .child(button("changes", "icons/ui/git-compare.svg", "Changes", () => run("screen.open", { mod: "changes", props: { space: s.id }, title: `${s.name} changes` })))
        .child(div().id("menu").w(44).h(44).items_center().justify_center().rounded(10).bg(t.raised)
          .on_click(() => openOverlay({ mod: "menu", kind: "sheet", props: { target: "space", id: s.id } }))
          .child(div().text_size(20).text_color(t.foreground).child("\u22ef"))))
      .child(div().px(16).pb(8).truncate().text_size(12).text_color(t.dim).child(`${s.machine} \u00b7 ${s.folder}`))
      .child(v_flex().flex_1().overflow_y_scroll().px(12).pb(24).gap(8)
        .children(s.tabs.map((tab, i) => this.tabRow(tab, i, t, all)))
        .when(s.tabs.length === 0, (el) => el.child(div().p(12).text_color(t.muted).child("No tabs. Tap New to start one."))));
  }
}

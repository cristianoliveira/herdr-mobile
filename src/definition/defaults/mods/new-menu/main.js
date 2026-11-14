// What to start, ported from herdr-app's new-menu: a terminal or an installed
// agent (a new tab in a space, or a new space on a machine), a new space,
// a worktree. props: { space } or { machine } (or neither: pick a machine).

import { View, div, h_flex, v_flex, svg, image } from "herdr-ui";
import { spaces, machines, knownAgents, run, openOverlay, closeOverlay, notify, theme, props } from "herdr";

export default class NewMenu extends View {
  init(_props, cx) {
    const p = props();
    this.space = p.space ? spaces().find((s) => s.id === p.space) : null;
    this.machine = this.space?.machine ?? p.machine ?? machines().find((m) => m.state === "connected")?.name ?? null;
    this.agents = null;
    this.load(cx);
  }

  load(cx) {
    this.agents = null;
    const on = this.machine;
    if (!on) return;
    cx.spawn(async (cx) => {
      try {
        this.agents = await knownAgents({ on });
      } catch {
        this.agents = [];
      }
      cx.notify();
    });
  }

  // In a space: a new tab, opened at once. Otherwise: a new space, folder asked first.
  start(argv, label) {
    closeOverlay(props().overlay);
    if (this.space) {
      run("tab.new", { space: this.space.id, ...(argv ? { argv } : {}) })
        .then((r) => run("terminal.show", { terminal: r.terminal }))
        .catch((e) => notify({ title: `Couldn't start ${label}`, body: e.message, level: "error" }));
      return;
    }
    openOverlay({
      mod: "prompt",
      kind: "dialog",
      props: { title: `New space on ${this.machine}`, label: "Folder", value: "~", field: "folder", open: true, command: { name: "space.new", args: { machine: this.machine, ...(argv ? { argv } : {}) } } },
    });
  }

  row(id, left, label, hint, action, enabled = true) {
    const t = theme();
    return h_flex().id(id).h(52).px(16).gap(14).items_center().rounded(10)
      .when(enabled, (el) => el.on_click(action))
      .child(div().w(24).items_center().child(left))
      .child(div().flex_1().truncate().text_size(16).text_color(enabled ? t.foreground : t.dim).child(label))
      .child(div().text_size(12).text_color(t.dim).child(hint ?? ""));
  }

  render(cx) {
    const t = theme();
    const s = this.space;
    const connected = machines().filter((m) => m.state === "connected");
    const installed = (this.agents ?? []).filter((a) => a.installed);
    const others = (this.agents ?? []).filter((a) => !a.installed).slice(0, 3);
    const agentIcon = (a) => (a.icon ? (a.tint ? svg(a.icon).size(20).text_color(t.foreground) : image(a.icon).size(20)) : div());
    const section = (text) => div().px(16).pt(14).pb(4).text_size(13).text_color(t.dim).child(text);
    return v_flex().w_full().pb(8)
      .child(div().px(16).py(8).text_size(15).font_semibold().text_color(t.foreground).child(s ? `New in ${s.name}` : this.machine ? `New space on ${this.machine}` : "No machine is connected"))
      .when(!s && connected.length > 1, (el) => el.child(h_flex().px(12).gap(8).flex_wrap()
        .children(connected.map((m) => div().id(`m-${m.name}`).px(12).py(8).rounded(16).bg(m.name === this.machine ? t.accent : t.raised)
          .on_click((_e, cx) => {
            this.machine = m.name;
            this.load(cx);
            cx.notify();
          })
          .child(div().text_size(14).text_color(m.name === this.machine ? t.accent_foreground : t.foreground).child(m.name))))))
      .when(Boolean(this.machine), (el) => el
        .child(this.row("terminal", svg("icons/shell.svg").size(20).text_color(t.foreground), "Terminal", "", () => this.start(null, "a terminal")))
        .child(section("Start an agent"))
        .children(installed.map((a) => this.row(`agent-${a.key}`, agentIcon(a), a.name, "", () => this.start(a.run, a.name))))
        .children(others.map((a) => this.row(`agent-${a.key}`, agentIcon(a), a.name, "not installed", () => {}, false)))
        .when(this.agents === null, (el) => el.child(div().px(16).py(10).text_size(14).text_color(t.dim).child("Checking installed agents\u2026"))))
      .when(Boolean(s), (el) => el
        .child(div().h(1).mx(16).my(8).bg(t.border))
        .child(this.row("space", svg("icons/ui/plus.svg").size(20).text_color(t.foreground), "New space here", "", () => {
          closeOverlay(props().overlay);
          openOverlay({ mod: "prompt", kind: "dialog", props: { title: `New space on ${s.machine}`, label: "Folder", value: s.folder, field: "folder", open: true, command: { name: "space.new", args: { machine: s.machine } } } });
        }))
        .child(this.row("worktree", svg("icons/ui/git-branch.svg").size(20).text_color(t.foreground), "New worktree\u2026", "", () => {
          closeOverlay(props().overlay);
          openOverlay({ mod: "worktree", kind: "sheet", props: { space: s.id, action: "new" } });
        }))
        .child(this.row("worktree-open", svg("icons/ui/git-branch.svg").size(20).text_color(t.foreground), "Open worktree\u2026", "", () => {
          closeOverlay(props().overlay);
          openOverlay({ mod: "worktree", kind: "sheet", props: { space: s.id, action: "open" } });
        })));
  }
}

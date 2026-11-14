// Menus, ported from herdr-app's menu: what you can do to a space, a tab or
// an agent. props: { target: "space" | "tab", id } or { target: "agent", terminal }.

import { View, div, h_flex, v_flex, svg } from "herdr-ui";
import { spaces, terminals, run, openOverlay, closeOverlay, notify, shared, setShared, exec, theme, props } from "herdr";

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const first = s.tabs.flatMap((t) => t.terminals)[0];
  return terminals().find((t) => t.address === first)?.cwd || s.folder;
}

export default class Menu extends View {
  init(_props, cx) {
    this.git = null; // "main", "linked" or null
    const p = props();
    const s = p.target === "space" && spaces().find((x) => x.id === p.id);
    if (s) {
      cx.spawn(async (cx) => {
        try {
          const r = await exec("sh", ["-c", 'top=$(git rev-parse --show-toplevel) && common=$(git rev-parse --path-format=absolute --git-common-dir) && [ "$common" = "$top/.git" ] && echo main || echo linked'], { cwd: place(s), on: s.machine });
          this.git = r.code === 0 ? r.stdout.trim() : null;
        } catch {}
        cx.notify();
      });
    }
  }

  items() {
    const p = props();
    if (p.target === "space") {
      const s = spaces().find((x) => x.id === p.id);
      if (!s) return [];
      const mine = spaces().filter((x) => x.machine === s.machine);
      const at = mine.findIndex((x) => x.id === s.id) + 1;
      return [
        ["Rename", "square-pen", () => openOverlay({ mod: "prompt", kind: "dialog", props: { title: "Rename space", label: "Name", value: s.named ? s.name : "", hint: "Empty: called after its folder again.", field: "name", command: { name: "space.rename", args: { id: s.id } } } })],
        ["New tab", "plus", () => openOverlay({ mod: "new-menu", kind: "sheet", props: { space: s.id } })],
        ...(at > 1 ? [["Move up", "chevron-left", () => run("space.move", { id: s.id, index: at - 1 })]] : []),
        ...(at < mine.length ? [["Move down", "chevron-right", () => run("space.move", { id: s.id, index: at + 1 })]] : []),
        ["Changes", "git-compare", () => run("screen.open", { mod: "changes", props: { space: s.id }, title: `${s.name} changes` })],
        ...(this.git ? [["New worktree", "git-branch", () => openOverlay({ mod: "worktree", kind: "sheet", props: { space: s.id, action: "new" } })], ["Open worktree", "git-branch", () => openOverlay({ mod: "worktree", kind: "sheet", props: { space: s.id, action: "open" } })]] : []),
        ...(this.git === "linked" ? [["Remove worktree", "x", () => openOverlay({ mod: "worktree", kind: "sheet", props: { space: s.id, action: "remove" } })]] : []),
        ["Close space", "x", () => run("space.close", { id: s.id }), true],
      ];
    }
    if (p.target === "tab") {
      const s = spaces().find((x) => x.tabs.some((t) => t.id === p.id));
      const tab = s?.tabs.find((t) => t.id === p.id);
      if (!tab) return [];
      const at = s.tabs.indexOf(tab) + 1;
      return [
        ["Rename", "square-pen", () => openOverlay({ mod: "prompt", kind: "dialog", props: { title: "Rename tab", label: "Name", value: tab.name, field: "name", command: { name: "tab.rename", args: { id: tab.id } } } })],
        ...(at > 1 ? [["Move up", "chevron-left", () => run("tab.move", { id: tab.id, index: at - 1 })]] : []),
        ...(at < s.tabs.length ? [["Move down", "chevron-right", () => run("tab.move", { id: tab.id, index: at + 1 })]] : []),
        ["Close tab", "x", () => run("tab.close", { id: tab.id }), true],
      ];
    }
    if (p.target === "agent") {
      const term = terminals().find((x) => x.address === p.terminal);
      if (!term) return [];
      const pins = shared("agents.pins") ?? [];
      const pinned = pins.includes(term.address);
      return [
        ["Open", "terminal", () => run("terminal.show", { terminal: term.address })],
        [pinned ? "Unpin" : "Pin to the top", pinned ? "pin-off" : "pin", () => setShared("agents.pins", pinned ? pins.filter((x) => x !== term.address) : [...pins, term.address])],
        ...(term.state === "live" ? [["Interrupt", "square", () => run("terminal.interrupt", { terminal: term.address })]] : []),
        ["Copy output", "file-text", () => run("terminal.copy", { terminal: term.address }).then(() => notify({ title: "Output copied" }))],
        ...(term.state === "live" ? [["Kill", "x", () => run("terminal.kill", { terminal: term.address }), true]] : []),
        ["Close", "x", () => run("terminal.close", { terminal: term.address }), true],
      ];
    }
    return [];
  }

  render() {
    const t = theme();
    return v_flex().w_full().px(8).pb(8)
      .children(this.items().map(([label, icon, action, danger]) => h_flex().id(label).h(52).px(12).gap(14).items_center().rounded(10)
        .on_click(() => {
          closeOverlay(props().overlay);
          Promise.resolve(action()).catch((e) => notify({ title: `${label} failed`, body: e.message, level: "error" }));
        })
        .child(svg(`icons/ui/${icon}.svg`).size(20).text_color(danger ? t.blocked : t.muted))
        .child(div().text_size(16).text_color(danger ? t.blocked : t.foreground).child(label))));
  }
}

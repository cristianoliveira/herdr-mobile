// A space's git changes, ported from herdr-app's changes panel: the files
// that changed with their line counts, a file's diff on its own screen, and
// a commit of everything. props: { space } or { space, file }.

import { View, div, h_flex, v_flex, input } from "herdr-ui";
import { spaces, terminals, exec, run, notify, theme, props } from "herdr";

const MAX_LINES = 3000;

function place(s) {
  const first = s.tabs.flatMap((t) => t.terminals)[0];
  return terminals().find((t) => t.address === first)?.cwd || s.folder;
}

export default class Changes extends View {
  init(_props, cx) {
    this.s = spaces().find((x) => x.id === props().space);
    this.files = null;
    this.lines = null;
    this.message = "";
    this.refresh(cx);
  }

  git(args) {
    return exec("git", args, { cwd: this.root, on: this.s.machine });
  }

  refresh(cx) {
    if (!this.s) return;
    cx.spawn(async (cx) => {
      try {
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: place(this.s), on: this.s.machine });
        if (top.code !== 0) {
          this.error = "Not a git repository";
          return cx.notify();
        }
        this.root = top.stdout.trim();
        const head = await this.git(["rev-parse", "--verify", "HEAD"]);
        this.hasHead = head.code === 0;
        if (props().file) await this.diff(props().file);
        else await this.list();
        this.error = null;
      } catch (e) {
        this.error = e.message;
      }
      cx.notify();
    });
  }

  async list() {
    const status = await this.git(["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"]);
    if (status.code !== 0) throw new Error(status.stderr);
    const stats = {};
    const runs = this.hasHead ? [["diff", "HEAD", "--numstat", "-z", "--no-renames"]] : [["diff", "--cached", "--numstat", "-z", "--no-renames"], ["diff", "--numstat", "-z", "--no-renames"]];
    for (const args of runs) {
      const r = await this.git(args);
      for (const entry of r.stdout.split("\0")) {
        const [a, d, ...parts] = entry.split("\t");
        if (!parts.length) continue;
        const path = parts.join("\t");
        const old = stats[path] ?? { add: 0, del: 0 };
        stats[path] = { add: old.add + (Number(a) || 0), del: old.del + (Number(d) || 0) };
      }
    }
    this.files = status.stdout.split("\0").filter(Boolean).slice(0, 1000).map((entry) => {
      const xy = entry.slice(0, 2);
      const path = entry.slice(3);
      const fresh = xy === "??";
      const s = xy.includes("U") || xy === "AA" || xy === "DD" ? "U" : xy.includes("D") ? "D" : fresh || xy.includes("A") ? "A" : "M";
      return { path, status: s, fresh, ...(stats[path] ?? { add: 0, del: 0 }) };
    });
  }

  async diff(path) {
    const status = await this.git(["status", "--porcelain=v1", "--", path]);
    const fresh = status.stdout.startsWith("??");
    const r = fresh || !this.hasHead
      ? await this.git(["diff", "--no-index", "--no-color", "--", "/dev/null", path])
      : await this.git(["diff", "HEAD", "--no-ext-diff", "--no-textconv", "--no-color", "--", path]);
    const all = r.stdout.split("\n");
    const start = all.findIndex((l) => l.startsWith("@@"));
    this.lines = (start < 0 ? all : all.slice(start)).slice(0, MAX_LINES);
    this.cut = all.length > MAX_LINES;
  }

  commit(cx) {
    const message = this.message.trim();
    if (!message || this.busy) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        for (const args of [["add", "-A"], ["commit", "-m", message]]) {
          const r = await this.git(args);
          if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
        }
        this.message = "";
        notify({ title: "Committed", body: message, level: "success" });
      } catch (e) {
        notify({ title: "Commit failed", body: e.message, level: "error" });
      }
      this.busy = false;
      this.refresh(cx);
    });
  }

  diffView(t) {
    const rows = (this.lines ?? []).map((l, i) => {
      const kind = l[0];
      return div().id(String(i)).px(12).py(1).font_mono().text_size(12)
        .when(l.startsWith("@@"), (el) => el.bg(t.raised).text_color(t.dim))
        .when(kind === "+" && !l.startsWith("@@"), (el) => el.bg(t.ansi2 + "22").text_color(t.foreground))
        .when(kind === "-" && !l.startsWith("@@"), (el) => el.bg(t.ansi1 + "22").text_color(t.foreground))
        .when(kind !== "+" && kind !== "-" && !l.startsWith("@@"), (el) => el.text_color(t.muted))
        .child(l || " ");
    });
    return v_flex().size_full().bg(t.background).overflow_y_scroll().pb(24)
      .on_refresh((_e, cx) => this.refresh(cx))
      .when(this.lines === null, (el) => el.child(div().p(16).text_color(t.muted).child("Reading\u2026")))
      .children(rows)
      .when(Boolean(this.cut), (el) => el.child(div().p(16).text_color(t.dim).child(`Only the first ${MAX_LINES} lines are shown.`)));
  }

  render(cx) {
    const t = theme();
    if (!this.s) return div().p(24).text_color(t.muted).child("That space is gone.");
    if (this.error) return v_flex().size_full().bg(t.background).p(24).child(div().text_color(t.muted).child(this.error));
    if (props().file) return this.diffView(t);
    const files = this.files;
    const color = { A: t.ansi2, D: t.ansi1, M: t.ansi3, U: t.blocked };
    return v_flex().size_full().bg(t.background)
      .child(v_flex().flex_1().overflow_y_scroll().pb(12)
        .on_refresh((_e, cx) => this.refresh(cx))
        .when(files === null, (el) => el.child(div().p(16).text_color(t.muted).child("Reading\u2026")))
        .when(files?.length === 0, (el) => el.child(div().p(16).text_color(t.muted).child("No changes.")))
        .children((files ?? []).map((f) => h_flex().id(f.path).min_h(48).px(16).gap(12).items_center()
          .on_click(() => run("screen.open", { mod: "changes", props: { space: this.s.id, file: f.path }, title: f.path.split("/").pop() }))
          .child(div().w(16).font_mono().font_bold().text_color(color[f.status]).child(f.status))
          .child(div().flex_1().truncate().text_size(14).text_color(t.foreground).child(f.path))
          .when(f.add > 0, (el) => el.child(div().text_size(12).text_color(t.ansi2).child(`+${f.add}`)))
          .when(f.del > 0, (el) => el.child(div().text_size(12).text_color(t.ansi1).child(`\u2212${f.del}`))))))
      .when(Boolean(files?.length), (el) => el.child(h_flex().p(12).gap(8).items_center().border_t(1).border_color(t.border).bg(t.chrome)
        .child(input("message").placeholder("Commit message").flex_1().px(12).py(10).rounded(10).border(1).border_color(t.input).bg(t.background).text_size(15).text_color(t.foreground)
          .value(this.message)
          .on_change((e) => { this.message = e.text; })
          .on_submit((e, cx) => { this.message = e.text; this.commit(cx); }))
        .child(div().id("commit").px(14).py(10).rounded(10).bg(t.solid).on_click((_e, cx) => this.commit(cx))
          .child(div().text_size(15).font_medium().text_color(t.solid_foreground).child(this.busy ? "\u2026" : "Commit")))));
  }
}

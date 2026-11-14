// Git worktrees as spaces, ported from herdr-app's worktree mod: make one
// (checked out at ~/.herdr/worktrees/<repo>/<branch> on the space's machine),
// open one of the repo's checkouts, or remove a worktree and its space.
// props: { space, action: "new" | "open" | "remove" }.

import { View, div, h_flex, v_flex, svg, input } from "herdr-ui";
import { spaces, terminals, run, exec, closeOverlay, notify, theme, props } from "herdr";

function place(s) {
  const first = s.tabs.flatMap((t) => t.terminals)[0];
  return terminals().find((t) => t.address === first)?.cwd || s.folder;
}

async function git(cwd, args, on) {
  const r = await exec("git", args, { cwd, on });
  return { ok: r.code === 0, out: (r.stdout ?? "").trim(), err: (r.stderr || r.stdout || "").trim() };
}

export default class Worktree extends View {
  init(_props, cx) {
    this.s = spaces().find((x) => x.id === props().space);
    this.on = this.s?.machine;
    this.text = "";
    this.error = "";
    this.busy = false;
    this.repo = undefined; // undefined: looking; null: not in git
    this.list = null;
    if (!this.s) return;
    cx.spawn(async (cx) => {
      const folder = place(this.s);
      const top = await git(folder, ["rev-parse", "--show-toplevel"], this.on);
      const common = await git(folder, ["rev-parse", "--path-format=absolute", "--git-common-dir"], this.on);
      if (!top.ok || !common.ok) {
        this.repo = null;
        return cx.notify();
      }
      const main = common.out.endsWith("/.git") ? common.out.slice(0, -5) : common.out;
      this.repo = { top: top.out, main, name: main.split("/").pop(), linked: main !== top.out };
      const home = await exec("sh", ["-c", 'printf %s "$HOME"'], { on: this.on });
      this.home = home.stdout;
      if (props().action === "open") {
        const r = await git(main, ["worktree", "list", "--porcelain"], this.on);
        this.list = r.out.split("\n\n").map((block) => {
          const path = block.match(/^worktree (.+)$/m)?.[1];
          const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? "(detached)";
          return path ? { path, branch } : null;
        }).filter(Boolean);
      }
      cx.notify();
    });
  }

  done(f) {
    closeOverlay(props().overlay);
    Promise.resolve().then(f).catch((e) => notify({ title: "Worktree", body: e.message, level: "error" }));
  }

  // The space showing a checkout, or a new one there.
  openAt(path) {
    const s = spaces().find((x) => x.machine === this.on && (x.folder === path || place(x) === path));
    this.done(async () => {
      const id = s ? s.id : (await run("space.new", { machine: this.on, folder: path })).space;
      await run("screen.open", { mod: "space", props: { space: id }, title: s?.name ?? path.split("/").pop() });
    });
  }

  create(cx) {
    const branch = this.text.trim();
    if (!branch || this.busy || !this.repo) return;
    this.busy = true;
    this.error = "";
    cx.notify();
    cx.spawn(async (cx) => {
      const path = `${this.home}/.herdr/worktrees/${this.repo.name}/${branch.replace(/\//g, "-")}`;
      const exists = await git(this.repo.main, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], this.on);
      const r = await git(this.repo.main, exists.ok ? ["worktree", "add", path, branch] : ["worktree", "add", "-b", branch, path], this.on);
      this.busy = false;
      if (!r.ok) {
        this.error = r.err || "git worktree add failed";
        return cx.notify();
      }
      this.openAt(path);
    });
  }

  remove(cx) {
    if (this.busy || !this.repo?.linked) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      const r = await git(this.repo.main, ["worktree", "remove", this.repo.top], this.on);
      this.busy = false;
      if (!r.ok) {
        this.error = r.err || "git worktree remove failed";
        return cx.notify();
      }
      this.done(() => run("space.close", { id: this.s.id, confirmed: true }));
    });
  }

  render(cx) {
    const t = theme();
    const action = props().action;
    const title = action === "new" ? "New worktree" : action === "open" ? "Open worktree" : "Remove worktree";
    const box = v_flex().w_full().p(20).gap(12).child(div().text_size(17).font_semibold().text_color(t.foreground).child(title));
    const button = (id, text, bg, fg, f) => div().id(id).px(16).py(10).rounded(10).bg(bg).on_click(f).child(div().text_size(15).font_medium().text_color(fg).child(text));
    if (!this.s) return box.child(div().text_color(t.muted).child("That space is gone."));
    if (this.repo === undefined) return box.child(div().text_color(t.muted).child("Looking at the repo\u2026"));
    if (this.repo === null) return box.child(div().text_color(t.muted).child(`${place(this.s)} is not in a git repository.`));
    const err = this.error ? div().text_size(13).text_color(t.blocked).child(this.error) : null;
    if (action === "new") {
      return box
        .child(div().text_size(13).text_color(t.dim).child(`Branch, checked out at ~/.herdr/worktrees/${this.repo.name}/<branch> on ${this.on}`))
        .child(input("branch").placeholder("branch name").autofocus().px(12).py(10).rounded(10).border(1).border_color(t.input).bg(t.background).text_size(16).text_color(t.foreground)
          .on_change((e) => { this.text = e.text; })
          .on_submit((e, cx) => { this.text = e.text; this.create(cx); }))
        .child(err)
        .child(h_flex().justify_end().gap(8)
          .child(button("cancel", "Cancel", t.raised, t.foreground, () => closeOverlay(props().overlay)))
          .child(button("create", this.busy ? "Creating\u2026" : "Create", t.solid, t.solid_foreground, (_e, cx) => this.create(cx))));
    }
    if (action === "open") {
      return box.child(v_flex().max_h(420).overflow_y_scroll()
        .when(this.list === null, (el) => el.child(div().text_color(t.muted).child("Reading worktrees\u2026")))
        .children((this.list ?? []).map((w) => h_flex().id(w.path).min_h(52).py(6).gap(12).items_center().on_click(() => this.openAt(w.path))
          .child(svg("icons/ui/git-branch.svg").size(20).text_color(t.muted))
          .child(v_flex().flex_1().min_w(0)
            .child(div().truncate().text_size(16).text_color(t.foreground).child(w.branch))
            .child(div().truncate().text_size(12).text_color(t.dim).child(w.path))))));
    }
    if (!this.repo.linked) return box.child(div().text_color(t.muted).child("This space is the repo's main checkout, not a worktree."));
    return box
      .child(div().text_size(15).text_color(t.muted).child(`Remove ${this.repo.top} and close its space? Git refuses if it has changes that aren't committed.`))
      .child(err)
      .child(h_flex().justify_end().gap(8)
        .child(button("cancel", "Cancel", t.raised, t.foreground, () => closeOverlay(props().overlay)))
        .child(button("remove", this.busy ? "Removing\u2026" : "Remove", t.blocked, "#ffffff", (_e, cx) => this.remove(cx))));
  }
}

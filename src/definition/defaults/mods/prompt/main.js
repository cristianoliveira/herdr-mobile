// One question, ported from herdr-app's prompt: Save runs the command with
// the answer as one of its arguments.
// props: { title, label, value, hint?, field, command: { name, args }, open? }
// (open: show the terminal the command returns).

import { View, div, h_flex, v_flex, input } from "herdr-ui";
import { run, closeOverlay, notify, theme, props } from "herdr";

export default class Prompt extends View {
  init() {
    this.text = props().value ?? "";
  }

  submit() {
    const p = props();
    closeOverlay(p.overlay);
    run(p.command.name, { ...(p.command.args ?? {}), [p.field ?? "name"]: this.text })
      .then((r) => {
        if (p.open && r?.terminal) return run("terminal.show", { terminal: r.terminal });
      })
      .catch((e) => notify({ title: p.title ?? "Failed", body: e.message, level: "error" }));
  }

  render() {
    const t = theme();
    const p = props();
    const button = (id, text, primary, action) => div().id(id).px(16).py(10).rounded(10).bg(primary ? t.solid : t.raised).on_click(action)
      .child(div().text_size(15).font_medium().text_color(primary ? t.solid_foreground : t.foreground).child(text));
    return v_flex().w_full().p(20).gap(12)
      .child(div().text_size(17).font_semibold().text_color(t.foreground).child(p.title ?? ""))
      .child(div().text_size(13).text_color(t.dim).child(p.label ?? ""))
      .child(input("answer").value(p.value ?? "").autofocus().px(12).py(10).rounded(10).border(1).border_color(t.input).bg(t.background).text_size(16).text_color(t.foreground)
        .on_change((e) => { this.text = e.text; })
        .on_submit((e) => { this.text = e.text; this.submit(); }))
      .when(Boolean(p.hint), (el) => el.child(div().text_size(13).text_color(t.dim).child(p.hint)))
      .child(h_flex().gap(8).justify_end().pt(4)
        .child(button("cancel", "Cancel", false, () => closeOverlay(p.overlay)))
        .child(button("save", "Save", true, () => this.submit())));
  }
}

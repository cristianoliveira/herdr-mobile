// Asks before something that ends terminals, ported from herdr-app's
// confirm. props: { title, detail, command: { name, args } }.

import { View, div, h_flex, v_flex } from "herdr-ui";
import { run, closeOverlay, notify, theme, props } from "herdr";

export default class Confirm extends View {
  render() {
    const t = theme();
    const p = props();
    const button = (id, text, bg, fg, action) => div().id(id).px(16).py(10).rounded(10).bg(bg).on_click(action).child(div().text_size(15).font_medium().text_color(fg).child(text));
    return v_flex().w_full().p(20).gap(12)
      .child(div().text_size(17).font_semibold().text_color(t.foreground).child(p.title ?? "Are you sure?"))
      .child(div().text_size(15).text_color(t.muted).child(p.detail ?? ""))
      .child(h_flex().gap(8).justify_end().pt(4)
        .child(button("no", "Cancel", t.raised, t.foreground, () => closeOverlay(p.overlay)))
        .child(button("yes", "Confirm", t.blocked, "#ffffff", () => {
          closeOverlay(p.overlay);
          run(p.command.name, p.command.args ?? {}).catch((e) => notify({ title: "Failed", body: e.message, level: "error" }));
        })));
  }
}

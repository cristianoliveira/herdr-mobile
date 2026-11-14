// How notifications look, ported from herdr-app's toast. Anything can post
// one with notify({ title, body, level, action }); tap runs its action.

import { View, div, h_flex, v_flex } from "herdr-ui";
import { run, closeOverlay, theme, props } from "herdr";

const DOT = { error: "blocked", warning: "working", success: "done", info: "accent" };

export default class Toast extends View {
  render() {
    const t = theme();
    const p = props();
    return h_flex().id("toast").w_full().px(16).py(12).gap(12).items_center()
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(div().size(9).rounded_full().bg(t[DOT[p.level] ?? "accent"]))
      .child(v_flex().flex_1().min_w(0)
        .child(div().truncate().text_size(15).font_semibold().text_color(t.foreground).child(p.title ?? ""))
        .when(Boolean(p.body), (el) => el.child(div().line_clamp(3).text_size(13).text_color(t.muted).child(p.body))));
  }
}

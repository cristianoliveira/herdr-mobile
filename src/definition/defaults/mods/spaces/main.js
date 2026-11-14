// Placeholder until the desktop port (phase 7).
import { View, div, v_flex } from "herdr-ui";
import { spaces, theme, props } from "herdr";

export default class Spaces extends View {
  render() {
    const t = theme();
    if (props().header) return div();
    return v_flex().p(12).gap(8).children(spaces().map((s) => div().id(s.id).text_color(t.foreground).child(s.name)));
  }
}

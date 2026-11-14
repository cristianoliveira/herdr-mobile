// Placeholder until the desktop port (phase 7).
import { View, div, v_flex } from "herdr-ui";
import { agents, theme, props } from "herdr";

export default class Agents extends View {
  render() {
    const t = theme();
    if (props().header) return div();
    return v_flex().p(12).gap(8).children(agents().map((a) => div().id(a.address).text_color(t.foreground).child(`${a.space_name} · ${a.status}`)));
  }
}

// herdr-ui: the elements a mod describes. The app draws them natively.
// Names follow desktop's gpui-kit wherever the idea is the same.

export class El {
  constructor(t, x) {
    this.t = t; // "b" box, "svg", "img", "icon", "input"
    this.s = null; // style, React Native names
    this.x = x ?? null; // what isn't style: path, name, lines, scroll, spin, key...
    this.h = null; // handlers: click, long_press, refresh, change, submit
    this.w = null; // swipe actions
    this.k = null; // children
  }
  _s(key, value) { (this.s ??= {})[key] = value; return this; }
  _x(key, value) { (this.x ??= {})[key] = value; return this; }
  _h(key, fn) {
    if (typeof fn !== "function") throw new TypeError(`${key} needs a function`);
    (this.h ??= {})[key] = fn;
    return this;
  }

  // Children and logic
  child(c) { (this.k ??= []).push(c); return this; }
  children(cs) { for (const c of cs ?? []) (this.k ??= []).push(c); return this; }
  when(cond, f) { return cond ? f(this) ?? this : this; }
  id(id) { return this._x("key", String(id)); }

  // Size and flex
  size_full() { return this._s("width", "100%")._s("height", "100%"); }
  w_full() { return this._s("width", "100%"); }
  h_full() { return this._s("height", "100%"); }
  w(n) { return this._s("width", n); }
  h(n) { return this._s("height", n); }
  size(n) { return this._s("width", n)._s("height", n); }
  min_w(n) { return this._s("minWidth", n); }
  min_h(n) { return this._s("minHeight", n); }
  max_w(n) { return this._s("maxWidth", n); }
  max_h(n) { return this._s("maxHeight", n); }
  flex_1() { return this._s("flex", 1); }
  flex_none() { return this._s("flexGrow", 0)._s("flexShrink", 0); }
  flex_grow(n = 1) { return this._s("flexGrow", n); }
  flex_shrink(n = 1) { return this._s("flexShrink", n); }
  flex_shrink_0() { return this._s("flexShrink", 0); }
  flex_wrap() { return this._s("flexWrap", "wrap"); }
  flex() { return this; }
  gap(n) { return this._s("gap", n); }
  gap_x(n) { return this._s("columnGap", n); }
  gap_y(n) { return this._s("rowGap", n); }

  // Spacing
  p(n) { return this._s("padding", n); }
  px(n) { return this._s("paddingHorizontal", n); }
  py(n) { return this._s("paddingVertical", n); }
  pt(n) { return this._s("paddingTop", n); }
  pb(n) { return this._s("paddingBottom", n); }
  pl(n) { return this._s("paddingLeft", n); }
  pr(n) { return this._s("paddingRight", n); }
  m(n) { return this._s("margin", n); }
  mx(n) { return this._s("marginHorizontal", n); }
  my(n) { return this._s("marginVertical", n); }
  mt(n) { return this._s("marginTop", n); }
  mb(n) { return this._s("marginBottom", n); }
  ml(n) { return this._s("marginLeft", n); }
  mr(n) { return this._s("marginRight", n); }

  // Alignment
  items_center() { return this._s("alignItems", "center"); }
  items_start() { return this._s("alignItems", "flex-start"); }
  items_end() { return this._s("alignItems", "flex-end"); }
  items_stretch() { return this._s("alignItems", "stretch"); }
  justify_center() { return this._s("justifyContent", "center"); }
  justify_start() { return this._s("justifyContent", "flex-start"); }
  justify_end() { return this._s("justifyContent", "flex-end"); }
  justify_between() { return this._s("justifyContent", "space-between"); }
  justify_around() { return this._s("justifyContent", "space-around"); }
  self_start() { return this._s("alignSelf", "flex-start"); }
  self_center() { return this._s("alignSelf", "center"); }
  self_end() { return this._s("alignSelf", "flex-end"); }
  self_stretch() { return this._s("alignSelf", "stretch"); }

  // Position
  relative() { return this._s("position", "relative"); }
  absolute() { return this._s("position", "absolute"); }
  top(n) { return this._s("top", n); }
  bottom(n) { return this._s("bottom", n); }
  left(n) { return this._s("left", n); }
  right(n) { return this._s("right", n); }
  inset_0() { return this._s("top", 0)._s("bottom", 0)._s("left", 0)._s("right", 0); }
  z_index(n) { return this._s("zIndex", n); }
  overflow_hidden() { return this._s("overflow", "hidden"); }

  // Paint
  bg(c) { return this._s("backgroundColor", c); }
  border(n = 1) { return this._s("borderWidth", n); }
  border_1() { return this._s("borderWidth", 1); }
  border_t(n = 1) { return this._s("borderTopWidth", n); }
  border_b(n = 1) { return this._s("borderBottomWidth", n); }
  border_l(n = 1) { return this._s("borderLeftWidth", n); }
  border_r(n = 1) { return this._s("borderRightWidth", n); }
  border_color(c) { return this._s("borderColor", c); }
  rounded(n) { return this._s("borderRadius", n); }
  rounded_full() { return this._s("borderRadius", 9999); }
  opacity(n) { return this._s("opacity", n); }

  // Text: applies to the strings inside
  text_size(n) { return this._s("fontSize", n); }
  text_color(c) { return this._s("color", c); }
  font_normal() { return this._s("fontWeight", "400"); }
  font_medium() { return this._s("fontWeight", "500"); }
  font_semibold() { return this._s("fontWeight", "600"); }
  font_bold() { return this._s("fontWeight", "700"); }
  font_mono() { return this._s("fontFamily", "monospace"); }
  italic() { return this._s("fontStyle", "italic"); }
  underline() { return this._s("textDecorationLine", "underline"); }
  line_through() { return this._s("textDecorationLine", "line-through"); }
  line_height(n) { return this._s("lineHeight", n); }
  text_center() { return this._s("textAlign", "center"); }
  text_right() { return this._s("textAlign", "right"); }
  text_left() { return this._s("textAlign", "left"); }
  truncate() { return this._x("lines", 1); }
  line_clamp(n) { return this._x("lines", n); }
  whitespace_nowrap() { return this._x("lines", 1); }

  // Touch
  on_click(fn) { return this._h("click", fn); }
  on_long_press(fn) { return this._h("long_press", fn); }
  swipe(direction, action) {
    if (direction !== "left" && direction !== "right") throw new TypeError('swipe direction is "left" or "right"');
    if (typeof action?.action !== "function") throw new TypeError("swipe needs { label, color, action }");
    (this.w ??= []).push({ direction, label: String(action.label ?? ""), color: action.color ?? null, action: action.action });
    return this;
  }

  // Scrolling
  overflow_y_scroll() { return this._x("scroll", "y"); }
  overflow_x_scroll() { return this._x("scroll", "x"); }
  overflow_y_scrollbar() { return this._x("scroll", "y"); }
  on_refresh(fn) { return this._h("refresh", fn); }

  // Motion
  spin(ms = 900) { return this._x("spin", ms); }

  // Inputs
  placeholder(text) { return this._x("placeholder", String(text)); }
  value(text) { return this._x("value", String(text)); }
  multiline() { return this._x("multiline", true); }
  autofocus() { return this._x("autofocus", true); }
  on_change(fn) { return this._h("change", fn); }
  on_submit(fn) { return this._h("submit", fn); }
}

export const div = () => new El("b");
export const v_flex = () => new El("b")._s("flexDirection", "column");
export const h_flex = () => new El("b")._s("flexDirection", "row");
/** An SVG file in the home, drawn in the text color. */
export const svg = (path) => new El("svg", { path: String(path) });
/** An image file in the home (SVG or PNG), drawn as it is. */
export const image = (path) => new El("img", { path: String(path) });
/** An Ionicons glyph by name. */
export const icon = (name) => new El("icon", { name: String(name) });
/** A text field. Its text stays on the phone: `.on_change` reports it, `.value` replaces it. */
export const input = (id) => new El("input", { key: String(id) });

/** A mod: export default class extends View. */
export class View {
  init(_props, _cx) {}
  render(_cx) { return null; }
}

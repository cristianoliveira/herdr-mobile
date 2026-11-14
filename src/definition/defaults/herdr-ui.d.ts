// herdr-ui: the elements a mod describes; the phone draws them natively.
// Written by Herdr Mobile on every connect. Edits here are overwritten.

/** One element. Every method returns the element, so calls chain. */
export declare class El {
  // Children and logic
  /** A child: an element, or a string (text), or null/false (nothing). */
  child(c: El | string | number | null | undefined | false): this;
  children(cs: (El | string | number | null | undefined | false)[]): this;
  /** `.when(cond, (el) => el.bg(...))`: applies f only when cond holds. */
  when(cond: unknown, f: (el: this) => El | void): this;
  /** A stable identity for the element among its siblings (keep it unique there). */
  id(id: string | number): this;

  // Size and flex (React Native flexbox: a div is a column, h_flex a row)
  size_full(): this;
  w_full(): this;
  h_full(): this;
  w(n: number): this;
  h(n: number): this;
  size(n: number): this;
  min_w(n: number): this;
  min_h(n: number): this;
  max_w(n: number): this;
  max_h(n: number): this;
  flex_1(): this;
  flex_none(): this;
  flex_grow(n?: number): this;
  flex_shrink(n?: number): this;
  flex_shrink_0(): this;
  flex_wrap(): this;
  /** No-op, kept so desktop code that calls it works. */
  flex(): this;
  gap(n: number): this;
  gap_x(n: number): this;
  gap_y(n: number): this;

  // Spacing
  p(n: number): this;
  px(n: number): this;
  py(n: number): this;
  pt(n: number): this;
  pb(n: number): this;
  pl(n: number): this;
  pr(n: number): this;
  m(n: number): this;
  mx(n: number): this;
  my(n: number): this;
  mt(n: number): this;
  mb(n: number): this;
  ml(n: number): this;
  mr(n: number): this;

  // Alignment
  items_center(): this;
  items_start(): this;
  items_end(): this;
  items_stretch(): this;
  justify_center(): this;
  justify_start(): this;
  justify_end(): this;
  justify_between(): this;
  justify_around(): this;
  self_start(): this;
  self_center(): this;
  self_end(): this;
  self_stretch(): this;

  // Position
  relative(): this;
  absolute(): this;
  top(n: number): this;
  bottom(n: number): this;
  left(n: number): this;
  right(n: number): this;
  inset_0(): this;
  z_index(n: number): this;
  overflow_hidden(): this;

  // Paint: colors are "#rrggbb", "#rrggbbaa", or theme() values
  bg(color: string): this;
  border(n?: number): this;
  border_1(): this;
  border_t(n?: number): this;
  border_b(n?: number): this;
  border_l(n?: number): this;
  border_r(n?: number): this;
  border_color(color: string): this;
  rounded(n: number): this;
  rounded_full(): this;
  opacity(n: number): this;

  // Text: applies to the strings inside, and to svg() and icon() colors
  text_size(n: number): this;
  text_color(color: string): this;
  font_normal(): this;
  font_medium(): this;
  font_semibold(): this;
  font_bold(): this;
  font_mono(): this;
  italic(): this;
  underline(): this;
  line_through(): this;
  line_height(n: number): this;
  text_center(): this;
  text_right(): this;
  text_left(): this;
  /** One line, cut with an ellipsis. */
  truncate(): this;
  line_clamp(lines: number): this;
  whitespace_nowrap(): this;

  // Touch: handlers get (event, cx)
  on_click(f: (event: {}, cx: Cx) => void): this;
  on_long_press(f: (event: {}, cx: Cx) => void): this;
  /** Slide the element to show an action: "right" swipes show it on the left. */
  swipe(direction: "left" | "right", action: { label: string; color?: string; action: (event: {}, cx: Cx) => void }): this;

  // Scrolling
  overflow_y_scroll(): this;
  overflow_x_scroll(): this;
  overflow_y_scrollbar(): this;
  /** Pull to refresh, on a scrolling element. */
  on_refresh(f: (event: {}, cx: Cx) => void): this;

  /** Turns once every ms (a spinner icon), drawn natively. */
  spin(ms?: number): this;

  // Inputs (input())
  placeholder(text: string): this;
  /** Replaces the field's text when this value changes; otherwise the text stays the person's. */
  value(text: string): this;
  multiline(): this;
  autofocus(): this;
  on_change(f: (event: { text: string }, cx: Cx) => void): this;
  on_submit(f: (event: { text: string }, cx: Cx) => void): this;
}

export declare function div(): El;
export declare function v_flex(): El;
export declare function h_flex(): El;
/** An SVG file in the home (icons/ui/plus.svg, mods/<name>/logo.svg), drawn in the text color. */
export declare function svg(path: string): El;
/** An image file in the home (SVG or PNG), drawn as it is. */
export declare function image(path: string): El;
/** An Ionicons glyph by name (https://ionic.io/ionicons). */
export declare function icon(name: string): El;
/** A text field. */
export declare function input(id: string): El;

/** What every callback gets. Don't keep it: each callback gets its own. */
export interface Cx {
  /** Draw this mod again. */
  notify(): void;
  /** Runs async work; errors go to the mod's error bar. */
  spawn(f: (cx: Cx) => Promise<void> | void): void;
  timer: {
    every(ms: number, f: (cx: Cx) => void): number;
    after(ms: number, f: (cx: Cx) => void): number;
    cancel(id: number): void;
  };
  /** No-op, kept so desktop code works. */
  stop_propagation(): void;
}

/** A mod: `export default class extends View`. */
export declare class View {
  /** Runs once, when the copy starts. */
  init(props: any, cx: Cx): void;
  /** Describes the UI; runs again after cx.notify() and when the app's data changes. */
  render(cx: Cx): El | null;
  /** Optional: runs once when the copy goes (its screen or sheet closed, the app quit). */
  close?(cx: Cx): Promise<void> | void;
}

// What a mod's render returns, as the app receives it (serialize() in
// src/mods/runtime/herdr.js). Strings are text.
export type Handler = "click" | "long_press" | "refresh" | "change" | "submit";

export type UIElement = {
  t: "b" | "svg" | "img" | "icon" | "input";
  /** Style, with React Native's names. Text styles apply to the strings inside. */
  s?: Record<string, any>;
  key?: string;
  /** Lines of text before it's cut (truncate: 1). */
  lines?: number;
  scroll?: "x" | "y";
  spin?: number;
  path?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  multiline?: boolean;
  autofocus?: boolean;
  /** Handlers: callback ids for this render. */
  on?: Partial<Record<Handler, number>>;
  swipe?: { d: "left" | "right"; label: string; color: string | null; a: number }[];
  k?: UINode[];
};

export type UINode = string | UIElement;

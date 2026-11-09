export type CornerAction = "search" | "new" | "activity";

export const CORNER_ACTIONS = [
  { key: "search", label: "Search", x: -112, y: 0, requiresConnection: true },
  { key: "new", label: "New", x: -80, y: -80, requiresConnection: true },
  { key: "activity", label: "Activity", x: 0, y: -112, requiresConnection: false },
] as const;

export const CORNER_TRIGGER_SIZE = 56;
export const CORNER_ACTION_SIZE = 64;

export function cornerActionAt(x: number, y: number, connected: boolean): CornerAction | null {
  return CORNER_ACTIONS.find((action) => (!action.requiresConnection || connected)
    && Math.hypot(x - action.x, y - action.y) <= CORNER_ACTION_SIZE / 2 + 6)?.key ?? null;
}

export function cornerRelease(x: number, y: number, gesture: {
  moved: boolean;
  wasOpen: boolean;
  cancelled: boolean;
  connected: boolean;
}): CornerAction | "open" | "close" {
  if (gesture.cancelled) return "close";
  const action = cornerActionAt(x, y, gesture.connected);
  if (action) return action;
  return gesture.moved || gesture.wasOpen ? "close" : "open";
}

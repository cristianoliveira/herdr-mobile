import { describe, expect, test } from "vitest";
import { CORNER_ACTIONS, cornerActionAt, cornerRelease } from "../src/corner-actions";

describe("corner actions", () => {
  test.each(CORNER_ACTIONS)("selects $label at its center", (action) => {
    expect(cornerActionAt(action.x, action.y, true)).toBe(action.key);
  });

  test("the trigger, gaps and points outside the fan do not select actions", () => {
    expect(cornerActionAt(0, 0, true)).toBeNull();
    expect(cornerActionAt(-40, -40, true)).toBeNull();
    expect(cornerActionAt(-300, -300, true)).toBeNull();
    expect(cornerActionAt(112, 0, true)).toBeNull();
  });

  test("keeps Activity available offline but does not select Search or New", () => {
    expect(cornerActionAt(0, -112, false)).toBe("activity");
    expect(cornerActionAt(-112, 0, false)).toBeNull();
    expect(cornerActionAt(-80, -80, false)).toBeNull();
  });

  test("tap opens a folded menu and a second tap closes it", () => {
    expect(cornerRelease(0, 0, { moved: false, wasOpen: false, cancelled: false, connected: true })).toBe("open");
    expect(cornerRelease(0, 0, { moved: false, wasOpen: true, cancelled: false, connected: true })).toBe("close");
  });

  test("slide and release chooses an action from either menu state", () => {
    expect(cornerRelease(-112, 0, { moved: true, wasOpen: false, cancelled: false, connected: true })).toBe("search");
    expect(cornerRelease(-80, -80, { moved: true, wasOpen: true, cancelled: false, connected: true })).toBe("new");
  });

  test("returning to center or releasing outside cancels instead of keeping the menu open", () => {
    const gesture = { moved: true, wasOpen: false, cancelled: false, connected: true };

    expect(cornerRelease(0, 0, gesture)).toBe("close");
    expect(cornerRelease(-300, 0, gesture)).toBe("close");
  });

  test("cancelled and multi-touch gestures never invoke an action", () => {
    expect(cornerRelease(0, -112, { moved: true, wasOpen: false, cancelled: true, connected: true })).toBe("close");
  });

  test("releasing on a disabled action cancels", () => {
    expect(cornerRelease(-80, -80, { moved: true, wasOpen: false, cancelled: false, connected: false })).toBe("close");
  });
});

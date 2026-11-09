import { describe, expect, test } from "vitest";
import { createPanelHistory, shouldCaptureForwardSwipe, shouldOpenForwardPanel } from "../src/panel-navigation";

describe("panel navigation", () => {
  test("has no forward destination before a panel is visited", () => {
    const history = createPanelHistory();

    expect(history.snapshot()).toBeNull();
  });

  test("retains the last visited panel when returning to a list", () => {
    const history = createPanelHistory();

    history.visit("core:panel-a");

    expect(history.snapshot()).toBe("core:panel-a");
  });

  test("opening another panel replaces the forward destination", () => {
    const history = createPanelHistory();
    history.visit("core:panel-a");

    history.visit("other-core:panel-b");

    expect(history.snapshot()).toBe("other-core:panel-b");
  });

  test("notifies lists only when the destination changes and supports unsubscribe", () => {
    const history = createPanelHistory();
    const destinations: (string | null)[] = [];
    const unsubscribe = history.subscribe(() => destinations.push(history.snapshot()));

    history.visit("core:panel-a");
    history.visit("core:panel-a");
    history.visit("core:panel-b");
    unsubscribe();
    history.visit("core:panel-c");

    expect(destinations).toEqual(["core:panel-a", "core:panel-b"]);
  });

  test("captures only deliberate single-finger left swipes away from platform back edges", () => {
    expect(shouldCaptureForwardSwipe(-20, 2, 200, 400, 1)).toBe(true);
    expect(shouldCaptureForwardSwipe(30, 1, 200, 400, 1)).toBe(false);
    expect(shouldCaptureForwardSwipe(-6, 0, 200, 400, 1)).toBe(false);
    expect(shouldCaptureForwardSwipe(-20, 30, 200, 400, 1)).toBe(false);
    expect(shouldCaptureForwardSwipe(-20, 2, 12, 400, 1)).toBe(false);
    expect(shouldCaptureForwardSwipe(-20, 2, 390, 400, 1)).toBe(false);
    expect(shouldCaptureForwardSwipe(-20, 2, 200, 400, 2)).toBe(false);
  });

  test("short drags and diagonal scrolling do not open a panel", () => {
    expect(shouldOpenForwardPanel(-100, 4)).toBe(true);
    expect(shouldOpenForwardPanel(-50, 1)).toBe(false);
    expect(shouldOpenForwardPanel(-100, 70)).toBe(false);
    expect(shouldOpenForwardPanel(100, 0)).toBe(false);
  });
});

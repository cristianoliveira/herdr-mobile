import { expect, test } from "vitest";
import { enterSends, withoutTypedNewline } from "../src/terminal/composer";

test("a newline typed at the end or in the middle is an Enter", () => {
  expect(withoutTypedNewline("fix it", "fix it\n")).toBe("fix it");
  expect(withoutTypedNewline("fix it", "fix\n it")).toBe("fix it");
});

test("pasted text with newlines is no Enter", () => {
  expect(withoutTypedNewline("", "first\nsecond")).toBeNull();
  expect(withoutTypedNewline("first", "first\nsecond")).toBeNull();
  expect(withoutTypedNewline("fix it", "fix it!")).toBeNull();
});

test("Enter after typing sends", () => {
  expect(enterSends(null, 1000)).toBe(true);
  expect(enterSends({ at: 900, grew: 1 }, 1000)).toBe(true);
  expect(enterSends({ at: 990, grew: 1 }, 1000)).toBe(true);
});

test("Enter right after a dictated paragraph stays a newline", () => {
  expect(enterSends({ at: 995, grew: 40 }, 1000)).toBe(false);
  expect(enterSends({ at: 500, grew: 40 }, 1000)).toBe(true);
});

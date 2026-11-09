import { beforeEach, expect, test, vi } from "vitest";

const storage = vi.hoisted(() => ({ value: null as string | null, fail: false }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => storage.value,
    setItem: async (_key: string, value: string) => {
      if (storage.fail) throw new Error("Storage full");
      storage.value = value;
    },
  },
}));

import { appendSnippet, loadSnippets, saveSnippets } from "../src/terminal/snippets";

beforeEach(() => { storage.value = null; storage.fail = false; });

test("starts with no snippets and persists edits and deletion", async () => {
  expect(await loadSnippets()).toEqual([]);
  await saveSnippets([{ name: "Review", text: "Review this diff.\nCheck tests too." }]);
  expect(await loadSnippets()).toEqual([{ name: "Review", text: "Review this diff.\nCheck tests too." }]);
  await saveSnippets([{ name: "Review", text: "Check this change." }]);
  expect(await loadSnippets()).toEqual([{ name: "Review", text: "Check this change." }]);
  await saveSnippets([]);
  expect(await loadSnippets()).toEqual([]);
});

test.each([
  [{ name: "", text: "Text" }],
  [{ name: "Name", text: "  " }],
  [{ name: "Name", text: "\x1b[31m" }],
  [{ name: "Name", text: "Run\x00" }],
  [{ name: "x".repeat(61), text: "Text" }],
  [{ name: "Name", text: "x".repeat(10001) }],
  [{ name: "Same", text: "One" }, { name: "Same", text: "Two" }],
].map((snippets) => ({ snippets })))("rejects invalid snippets without overwriting saved data: $snippets", async ({ snippets }) => {
  await saveSnippets([{ name: "Existing", text: "Keep me" }]);
  const before = storage.value;
  await expect(saveSnippets(snippets)).rejects.toThrow();
  expect(storage.value).toBe(before);
});

test.each(["not json", "{}", '[{"name":"Name","text":4}]', "[null]"])("reports corrupt saved data instead of discarding it: %s", async (raw) => {
  storage.value = raw;
  await expect(loadSnippets()).rejects.toThrow();
  expect(storage.value).toBe(raw);
});

test("reports a failed save and keeps previous saved snippets", async () => {
  await saveSnippets([{ name: "Existing", text: "Keep me" }]);
  storage.fail = true;
  await expect(saveSnippets([])).rejects.toThrow("Storage full");
  expect(await loadSnippets()).toEqual([{ name: "Existing", text: "Keep me" }]);
});

test("inserts literal multiline text without losing the draft", () => {
  expect(appendSnippet("", "Hello\nworld")).toBe("Hello\nworld");
  expect(appendSnippet("Existing", "Hello")).toBe("Existing\nHello");
  expect(appendSnippet("Existing\n", "Hello")).toBe("Existing\nHello");
});

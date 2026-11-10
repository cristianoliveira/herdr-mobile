import { describe, expect, test, vi } from "vitest";
import {
  displayLinkTarget,
  openExternalLink,
  parseExternalLinkMessage,
  parseVisibleLinksMessage,
} from "../src/terminal/links";

describe("parseExternalLinkMessage", () => {
  test("accepts explicit HTTP and HTTPS link messages", () => {
    expect(parseExternalLinkMessage(JSON.stringify({ type: "link", url: "https://example.com/a?q=1" })))
      .toBe("https://example.com/a?q=1");
    expect(parseExternalLinkMessage(JSON.stringify({ type: "link", url: "http://localhost:3000/" })))
      .toBe("http://localhost:3000/");
  });

  test.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "intent://example.com",
    "https://",
    "https://example.com/" + "a".repeat(4096),
  ])("rejects unsafe or malformed URL %s", (url) => {
    expect(parseExternalLinkMessage(JSON.stringify({ type: "link", url }))).toBeNull();
  });

  test.each([
    "not-json",
    JSON.stringify({ type: "input", data: "https://example.com" }),
    JSON.stringify({ type: "link", url: 7 }),
    JSON.stringify({ type: "link", url: "https://example.com", extra: true }),
  ])("rejects malformed bridge message %s", (message) => {
    expect(parseExternalLinkMessage(message)).toBeNull();
  });
});

describe("parseVisibleLinksMessage", () => {
  test("accepts an empty list and filters unsafe destinations", () => {
    expect(parseVisibleLinksMessage(JSON.stringify({ type: "links", id: "1", urls: [] }), "1")).toEqual([]);
    expect(parseVisibleLinksMessage(JSON.stringify({
      type: "links",
      id: "2",
      urls: ["https://docs.example/a", "javascript:alert(1)"],
    }), "2")).toEqual(["https://docs.example/a"]);
  });

  test.each([
    JSON.stringify({ type: "links", id: "old", urls: ["https://example.com"] }),
    JSON.stringify({ type: "links", id: "1", urls: [3] }),
    JSON.stringify({ type: "links", id: "1", urls: [], extra: true }),
  ])("rejects malformed or stale list messages %s", (raw) => {
    expect(parseVisibleLinksMessage(raw, "1")).toBeNull();
  });
});

describe("openExternalLink", () => {
  test("opens a safe URL successfully", async () => {
    const openUrl = vi.fn().mockResolvedValue(undefined);
    const onFailure = vi.fn();

    await expect(openExternalLink("https://example.com", openUrl, onFailure)).resolves.toBe(true);

    expect(openUrl).toHaveBeenCalledWith("https://example.com/");
    expect(onFailure).not.toHaveBeenCalled();
  });

  test("opens a safe URL and reports a platform failure without throwing", async () => {
    const openUrl = vi.fn().mockRejectedValue(new Error("platform failure"));
    const onFailure = vi.fn();

    await expect(openExternalLink("https://example.com", openUrl, onFailure)).resolves.toBe(false);

    expect(openUrl).toHaveBeenCalledWith("https://example.com/");
    expect(onFailure).toHaveBeenCalledOnce();
  });

  test("does not invoke the platform for unsafe URLs", async () => {
    const openUrl = vi.fn();
    const onFailure = vi.fn();

    await expect(openExternalLink("javascript:alert(1)", openUrl, onFailure)).resolves.toBe(false);

    expect(openUrl).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });
});

test("displays a destination without exposing credentials or query values", () => {
  expect(displayLinkTarget("https://user:secret@example.com/private?token=secret#fragment"))
    .toBe("https://example.com/private?…");
});

import { describe, expect, test } from "vitest";
import { parseExternalLinkMessage } from "../src/terminal/links";

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

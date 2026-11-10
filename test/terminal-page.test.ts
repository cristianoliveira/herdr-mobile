import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, test, vi } from "vitest";

const page = readFileSync(new URL("../src/terminal/page.html", import.meta.url), "utf8");
const script = page.match(/<script>\s*(\(function \(\) \{[\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error("Terminal page script is missing");

afterEach(() => vi.useRealTimers());

describe("terminal page links", () => {
  test("offers wrapped plain URLs and activates them without posting a keyboard tap", () => {
    vi.useFakeTimers();
    const harness = createPageHarness();

    const links = provideLinks(harness, 2, [
      { isWrapped: false, text: "open https://exam" },
      { isWrapped: true, text: "ple.com/path now" },
    ]);

    expect(links).toHaveLength(1);
    expect(links[0].text).toBe("https://example.com/path");
    expect(links[0].range).toEqual({ start: { x: 6, y: 1 }, end: { x: 12, y: 2 } });

    harness.touchHandlers.touchstart({ touches: [{ clientX: 1, clientY: 1 }] });
    harness.touchHandlers.touchend({ stopPropagation() {} });
    links[0].activate(clickEvent());
    vi.runAllTimers();

    expect(harness.messages).toEqual([{ type: "ready" }, { type: "link", url: "https://example.com/path" }]);
  });

  test("activates OSC 8 HTTP(S) links, but ignores dangerous protocols", () => {
    const harness = createPageHarness();

    harness.linkHandler.activate(clickEvent(), "https://docs.example/guide");
    harness.linkHandler.activate(clickEvent(), "javascript:alert(1)");

    expect(harness.messages).toEqual([
      { type: "ready" },
      { type: "link", url: "https://docs.example/guide" },
    ]);
  });

  test("does not treat a vertical drag as an activation or keyboard tap", () => {
    vi.useFakeTimers();
    const harness = createPageHarness();
    harness.touchHandlers.touchstart({ touches: [{ clientX: 2, clientY: 40 }] });
    harness.touchHandlers.touchmove({
      touches: [{ clientX: 2, clientY: 20 }],
      preventDefault() {},
      stopPropagation() {},
    });
    harness.touchHandlers.touchend({ stopPropagation() {} });
    vi.runAllTimers();

    expect(harness.messages).toEqual([{ type: "ready" }]);
  });
});

function createPageHarness() {
  const messages: unknown[] = [];
  const touchHandlers: Record<string, (event: any) => void> = {};
  let provider: any;
  let linkHandler: any;
  const terminal: any = {
    options: {},
    modes: {},
    buffer: { active: { length: 0, getLine: () => undefined } },
    parser: { registerCsiHandler() {} },
    loadAddon() {},
    open() {},
    registerLinkProvider(value: unknown) { provider = value; },
    write() {},
    scrollToBottom() {},
    resize() {},
    scrollLines() {},
  };
  Object.defineProperty(terminal.options, "linkHandler", {
    get: () => linkHandler,
    set: (value) => { linkHandler = value; },
  });

  runInNewContext(script!, {
    Terminal: function () { return terminal; },
    FitAddon: { FitAddon: function () {} },
    ImageAddon: { ImageAddon: function () {} },
    document: {
      getElementById: () => ({ style: {}, querySelector: () => null }),
      body: { className: "" },
    },
    window: {
      ReactNativeWebView: { postMessage: (message: string) => messages.push(JSON.parse(message)) },
      addEventListener: (name: string, handler: (event: any) => void) => { touchHandlers[name] = handler; },
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
  });
  return {
    messages,
    touchHandlers,
    terminal,
    get provider() { return provider; },
    get linkHandler() { return linkHandler; },
  };
}

function provideLinks(harness: ReturnType<typeof createPageHarness>, lineNumber: number, lines: { isWrapped: boolean; text: string }[]) {
  const buffer = {
    length: lines.length,
    getLine: (number: number) => {
      const line = lines[number - 1];
      return line && { isWrapped: line.isWrapped, translateToString: () => line.text };
    },
  };
  harness.terminal.buffer.active = buffer;
  const result: any[] = [];
  harness.provider.provideLinks(
    lineNumber,
    (links: any[] | undefined) => result.push(...(links ?? [])),
  );
  return result;
}

function clickEvent() {
  return { preventDefault() {}, stopPropagation() {} };
}

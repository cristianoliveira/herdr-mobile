import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, test, vi } from "vitest";

const page = readFileSync(new URL("../src/terminal/page.html", import.meta.url), "utf8");
const script = page.match(/<script>\s*(\(function \(\) \{[\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error("Terminal page script is missing");

afterEach(() => vi.useRealTimers());

describe("terminal page links", () => {
  test("touch dispatch activates wrapped plain URLs without a hover or keyboard tap", () => {
    vi.useFakeTimers();
    const harness = createPageHarness();
    harness.setBuffer([
      makeLine("open https://exam"),
      makeLine("ple.com/path now", true),
    ]);

    const links = provideLinks(harness, 2);
    expect(links).toHaveLength(1);
    expect(links[0].text).toBe("https://example.com/path");
    expect(links[0].range).toEqual({ start: { x: 6, y: 1 }, end: { x: 12, y: 2 } });

    touch(harness, "touchstart", { touches: [{ clientX: 55, clientY: 30 }] });
    touch(harness, "touchend", { stopPropagation() {} });
    links[0].activate(clickEvent()); // A later WebView-synthesized click must not duplicate the native action.
    vi.runAllTimers();

    expect(harness.mouseEvents).toEqual(["mousemove", "mousedown", "mouseup"]);
    expect(harness.messages).toEqual([
      { type: "ready" },
      { type: "link", url: "https://example.com/path" },
    ]);
  });

  test("suppresses keyboard taps when native mouse activation precedes touchend", () => {
    vi.useFakeTimers();
    const harness = createPageHarness();
    harness.setBuffer([makeLine("https://example.com")]);
    const [link] = provideLinks(harness, 1);

    link.activate(clickEvent());
    touch(harness, "touchstart", { touches: [{ clientX: 15, clientY: 10 }] });
    touch(harness, "touchend", { stopPropagation() {} });
    vi.runAllTimers();

    expect(harness.messages).toEqual([
      { type: "ready" },
      { type: "link", url: "https://example.com" },
    ]);
  });

  test("maps wide and combining characters to terminal columns", () => {
    const harness = createPageHarness();
    harness.setBuffer([makeLineCells([["界", 2], ["e\u0301", 1], [" ", 1], ...Array.from("https://example.org", (char): [string, number] => [char, 1])])]);

    const links = provideLinks(harness, 1);

    expect(links).toHaveLength(1);
    expect(links[0].range).toEqual({ start: { x: 5, y: 1 }, end: { x: 23, y: 1 } });
  });

  test("touch dispatch activates OSC 8 links without opening dangerous protocols", () => {
    const harness = createPageHarness();
    harness.oscLink = { url: "https://docs.example/guide", row: 1, start: 1, end: 4 };

    touch(harness, "touchstart", { touches: [{ clientX: 15, clientY: 10 }] });
    touch(harness, "touchend", { stopPropagation() {} });

    expect(harness.messages).toEqual([
      { type: "ready" },
      { type: "link", url: "https://docs.example/guide" },
    ]);

    harness.linkHandler.activate(clickEvent(), "javascript:alert(1)");
    expect(harness.messages).toHaveLength(2);
  });

  test("a non-link tap still requests the keyboard", () => {
    vi.useFakeTimers();
    const harness = createPageHarness();
    harness.setBuffer([makeLine("ordinary terminal output")]);

    touch(harness, "touchstart", { touches: [{ clientX: 15, clientY: 10 }] });
    touch(harness, "touchend", { stopPropagation() {} });
    vi.runAllTimers();

    expect(harness.messages).toEqual([{ type: "ready" }, { type: "tap" }]);
  });

  test("scrolling, selection drags, and pinch gestures do not activate links", () => {
    vi.useFakeTimers();
    const harness = createPageHarness();
    harness.setBuffer([makeLine("https://example.com")]);

    touch(harness, "touchstart", { touches: [{ clientX: 15, clientY: 10 }] });
    touch(harness, "touchmove", {
      touches: [{ clientX: 15, clientY: 30 }],
      preventDefault() {},
      stopPropagation() {},
    });
    touch(harness, "touchend", { stopPropagation() {} });

    touch(harness, "touchstart", { touches: [{ clientX: 15, clientY: 10 }] });
    touch(harness, "touchmove", {
      touches: [{ clientX: 35, clientY: 10 }],
      preventDefault() {},
      stopPropagation() {},
    });
    touch(harness, "touchend", { stopPropagation() {} });

    touch(harness, "touchstart", {
      touches: [{ clientX: 15, clientY: 10 }, { clientX: 16, clientY: 11 }],
    });
    touch(harness, "touchend", { stopPropagation() {} });
    vi.runAllTimers();

    expect(harness.messages).toEqual([{ type: "ready" }]);
    expect(harness.mouseEvents).toEqual([]);
  });
});

function createPageHarness() {
  const messages: unknown[] = [];
  const touchHandlers: Record<string, (event: any) => void> = {};
  const mouseEvents: string[] = [];
  let provider: any;
  let linkHandler: any;
  let buffer = makeBuffer([]);
  let currentLink: any;
  let pressedLink: any;
  const root: any = { style: {}, querySelector: () => screen };
  const screen: any = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 480 }),
    dispatchEvent(event: any) {
      mouseEvents.push(event.type);
      const row = Math.floor(event.clientY / 20) + 1;
      const column = Math.floor(event.clientX / 10) + 1;
      if (event.type === "mousemove") {
        currentLink = undefined;
        provider.provideLinks(row, (links: any[] | undefined) => {
          currentLink = links?.find((link) => contains(link.range, row, column));
        });
        if (oscLink && oscLink.row === row && column >= oscLink.start && column <= oscLink.end) {
          currentLink = { activate: (mouseEvent: unknown) => linkHandler.activate(mouseEvent, oscLink!.url) };
        }
      } else if (event.type === "mousedown") {
        pressedLink = currentLink;
      } else if (event.type === "mouseup" && currentLink && pressedLink === currentLink) {
        currentLink.activate(event, currentLink.text);
      }
      return true;
    },
  };
  let oscLink: { url: string; row: number; start: number; end: number } | null = null;
  const terminal: any = {
    options: {},
    modes: {},
    buffer: { get active() { return buffer; } },
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
    MouseEvent: function (type: string, options: object) {
      return { type, ...options, preventDefault() {}, stopPropagation() {} };
    },
    document: {
      getElementById: () => root,
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
    mouseEvents,
    setBuffer(lines: ReturnType<typeof makeLine>[]) { buffer = makeBuffer(lines); },
    set oscLink(value: typeof oscLink) { oscLink = value; },
    get provider() { return provider; },
    get linkHandler() { return linkHandler; },
    touchHandlers,
  };
}

function makeBuffer(lines: ReturnType<typeof makeLine>[]) {
  return {
    length: lines.length,
    viewportY: 0,
    getLine: (zeroBasedIndex: number) => lines[zeroBasedIndex],
  };
}

function makeLine(text: string, isWrapped = false) {
  return makeLineCells(Array.from(text, (char) => [char, 1]), isWrapped);
}

function makeLineCells(cells: [string, number][], isWrapped = false) {
  return {
    isWrapped,
    length: cells.reduce((total, [, width]) => total + width, 0),
    getCell(column: number) {
      let at = 0;
      for (const [chars, width] of cells) {
        if (column >= at && column < at + width) {
          return {
            getChars: () => (column === at ? chars : ""),
            getWidth: () => (column === at ? width : 0),
          };
        }
        at += width;
      }
      return undefined;
    },
  };
}

function provideLinks(harness: ReturnType<typeof createPageHarness>, lineNumber: number) {
  const result: any[] = [];
  harness.provider.provideLinks(lineNumber, (links: any[] | undefined) => result.push(...(links ?? [])));
  return result;
}

function touch(harness: ReturnType<typeof createPageHarness>, event: string, data: object) {
  harness.touchHandlers[event]({ ...data, stopPropagation() {}, preventDefault() {} });
}

function contains(range: any, row: number, column: number) {
  const start = range.start.y * 80 + range.start.x;
  const end = range.end.y * 80 + range.end.x;
  const point = row * 80 + column;
  return start <= point && point <= end;
}

function clickEvent() {
  return { preventDefault() {}, stopPropagation() {} };
}

// xterm.js in a WebView, fed by a herdr-core attach stream. Acknowledges bytes
// only after xterm has drawn them, so a slow phone gets a repaint instead of
// an endless backlog.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { toBase64, utf8Encode } from "../hc/bytes";
import type { AttachStream, HcConnection } from "../hc/connection";
import { colors } from "../ui/theme";
import { Sheet, SheetAction } from "../ui/Sheet";
import { rememberFitSize } from "./fit";
import {
  displayLinkTarget,
  openExternalLink,
  parseExternalLinkMessage,
  parseVisibleLinksMessage,
} from "./links";
import { TERMINAL_HTML } from "./terminal-html.generated";

export type TerminalMode = "fit" | "full";

type Props = {
  conn: HcConnection | null;
  address: string;
  cols: number;
  rows: number;
  /** Changes when a kept terminal restarts with a new program. */
  pid: number | null | undefined;
  mode: TerminalMode;
  fontSize: number;
  /** A tap on the terminal: the screen opens the keyboard. */
  onTap?: () => void;
  onSwipeBack?: () => void;
};

export type TerminalHandle = {
  /** Type raw bytes into the terminal. False when not attached. */
  write: (bytes: Uint8Array) => boolean;
  /** Whether the program asked for application cursor keys (arrows as ESC O A). */
  appCursor: () => boolean;
  /** Whether the program wants pastes wrapped (bracketed paste). */
  bracketedPaste: () => boolean;
  /** Back to the live screen, e.g. when typing after scrolling up. */
  scrollToBottom: () => void;
  /** Currently visible HTTP(S) links, for the session action menu. */
  listVisibleLinks: () => Promise<string[]>;
  /** Open a link selected from the accessible session action menu. */
  openExternalLink: (url: string) => void;
};

export const TerminalView = forwardRef<TerminalHandle, Props>(function TerminalView({ conn, address, cols, rows, pid, mode, fontSize, onTap, onSwipeBack }, ref) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [fitSize, setFitSize] = useState<{ cols: number; rows: number } | null>(null);
  const fitRef = useRef(fitSize);
  fitRef.current = fitSize;
  const stream = useRef<AttachStream | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);
  const [linkToOpen, setLinkToOpen] = useState<string | null>(null);
  const pending = useRef<Uint8Array[]>([]);
  const appCursor = useRef(false);
  const bracketed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextLinkRequestId = useRef(0);
  const pendingLinkRequest = useRef<{
    id: string;
    resolve: (urls: string[]) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    write: (bytes) => {
      if (!stream.current) return false;
      stream.current.write(bytes);
      return true;
    },
    appCursor: () => appCursor.current,
    bracketedPaste: () => bracketed.current,
    scrollToBottom: () => post({ type: "bottom" }),
    listVisibleLinks: () => {
      if (!ready) return Promise.resolve([]);
      pendingLinkRequest.current?.resolve([]);
      if (pendingLinkRequest.current) clearTimeout(pendingLinkRequest.current.timer);
      const id = String(++nextLinkRequestId.current);
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (pendingLinkRequest.current?.id !== id) return;
          pendingLinkRequest.current = null;
          resolve([]);
        }, 3000);
        pendingLinkRequest.current = { id, resolve, timer: timeout };
        post({ type: "listLinks", id });
      });
    },
    openExternalLink: (candidate) => void launchLink(candidate),
  }));

  const post = (msg: object) =>
    web.current?.injectJavaScript(`window.hc && window.hc.receive(${JSON.stringify(msg)}); true;`);

  const flush = () => {
    timer.current = null;
    const chunks = pending.current;
    pending.current = [];
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const all = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      all.set(c, at);
      at += c.length;
    }
    if (total) post({ type: "write", data: toBase64(all) });
  };

  const queue = (bytes: Uint8Array) => {
    pending.current.push(bytes);
    if (!timer.current) timer.current = setTimeout(flush, 16);
  };

  useEffect(() => {
    if (!ready) return;
    post({ type: "mode", mode: mode === "fit" ? "fit" : "view", cols, rows });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode]);

  useEffect(() => {
    if (ready) post({ type: "font", size: fontSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fontSize]);

  useEffect(() => {
    if (mode !== "full") return;
    // Typing makes this viewer the one that sets the size: keep it the terminal's own.
    stream.current?.resize(cols, rows);
    if (ready) post({ type: "size", cols, rows });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows]);

  const haveFit = fitSize !== null;
  useEffect(() => {
    if (!ready || !conn) return;
    if (mode === "fit" && !fitRef.current) return;
    let cancelled = false;
    let mine: AttachStream | null = null;
    pending.current = [];
    post({ type: "reset" });
    setEnded(null);
    const size = mode === "fit" ? fitRef.current! : { cols, rows };
    conn
      .attach(
        { terminal: address, cols: size.cols, rows: size.rows, history: 2000 },
        {
          onData: (bytes, s) => {
            if (cancelled) return;
            stream.current = s;
            queue(bytes);
          },
          onClose: (r) => {
            if (cancelled) return;
            stream.current = null;
            setEnded(r?.reason ? describe(r) : "closed");
          },
        },
      )
      .then(
        (s) => {
          mine = s;
          if (cancelled) s.close();
          else stream.current = s;
        },
        (e) => !cancelled && setEnded(e.message),
      );
    return () => {
      cancelled = true;
      mine?.close();
      stream.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, conn, address, mode, haveFit, pid]);

  const onMessage = (raw: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    const msg = parsed as Record<string, unknown>;
    if (msg.type === "ready") setReady(true);
    else if (msg.type === "written" && typeof msg.bytes === "number") stream.current?.ack(msg.bytes);
    else if (msg.type === "modes") {
      appCursor.current = msg.appCursor === true;
      bracketed.current = msg.bracketedPaste === true;
    }
    else if (msg.type === "tap") onTap?.();
    else if (msg.type === "back") onSwipeBack?.();
    else if (msg.type === "link") void openLink(raw);
    else if (msg.type === "links" && typeof msg.id === "string") {
      const request = pendingLinkRequest.current;
      if (!request || request.id !== msg.id) return;
      clearTimeout(request.timer);
      pendingLinkRequest.current = null;
      request.resolve(parseVisibleLinksMessage(raw, msg.id) ?? []);
    }
    else if (msg.type === "input" && typeof msg.data === "string") stream.current?.write(utf8Encode(msg.data));
    else if (msg.type === "size" && typeof msg.cols === "number" && typeof msg.rows === "number") {
      const size = { cols: msg.cols, rows: msg.rows };
      setFitSize(size);
      if (mode === "fit") rememberFitSize(size);
      if (mode === "fit") stream.current?.resize(size.cols, size.rows);
    }
  };

  const openLink = (raw: string) => {
    const url = parseExternalLinkMessage(raw);
    if (url) setLinkToOpen(url);
  };

  const launchLink = async (url: string) => {
    setLinkError(false);
    await openExternalLink(url, Linking.openURL, () => setLinkError(true));
  };

  return (
    <View style={styles.wrap}>
      <WebView
        ref={web}
        source={{ html: TERMINAL_HTML }}
        originWhitelist={["*"]}
        onMessage={(e) => onMessage(e.nativeEvent.data)}
        style={styles.web}
        setBuiltInZoomControls={mode === "full"}
        setDisplayZoomControls={false}
        overScrollMode="never"
        textZoom={100}
        keyboardDisplayRequiresUserAction
        hideKeyboardAccessoryView
        onContentProcessDidTerminate={() => setReady(false)}
      />
      <Sheet visible={linkToOpen !== null} onClose={() => setLinkToOpen(null)}>
        <SheetAction
          label="Open link in browser"
          detail={linkToOpen ? displayLinkTarget(linkToOpen) : "This opens outside Herdr."}
          onPress={() => {
            const url = linkToOpen;
            setLinkToOpen(null);
            if (url) void launchLink(url);
          }}
        />
      </Sheet>
      {(!conn || ended || linkError) && (
        <View style={styles.notice} pointerEvents="none">
          <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
            {linkError ? "Couldn't open link" : !conn ? "Reconnecting…" : ended}
          </Text>
        </View>
      )}
    </View>
  );
});

function describe(r: { reason?: string; exit_code?: number | null }): string {
  if (r.reason === "exited") return `Exited${r.exit_code != null ? ` with code ${r.exit_code}` : ""}`;
  return r.reason ?? "closed";
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  web: { flex: 1, backgroundColor: colors.bg },
  notice: { position: "absolute", top: 8, alignSelf: "center", backgroundColor: colors.surfaceHigh, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  noticeText: { color: colors.text, fontSize: 13 },
});

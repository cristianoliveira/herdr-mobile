// Everything that types into a terminal: the key bar, direct typing through a
// hidden field, and the message composer. Raw bytes go on the attach stream
// (instant, and hc's "someone is typing" hold doesn't apply to them); before it
// is attached, keys and text go through hc instead.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { utf8Encode } from "../hc/bytes";
import { HcError, type HcConnection } from "../hc/connection";
import { updateSettings, useSettings } from "../settings";
import { colors, fonts, radius, space } from "../ui/theme";
import { KEY_BAR, keyBytes } from "./keys";
import type { TerminalHandle } from "./TerminalView";
import { enterSends, SEND_DELAY_MS, withoutTypedNewline, type Change } from "./composer";
import { typedText, withCtrl } from "./typing";

export type TerminalInputHandle = { openKeyboard(): void };

type Props = {
  /** Resets typing state when it changes. */
  sessionKey: string;
  route: { conn: HcConnection; address: string };
  terminal: RefObject<TerminalHandle | null>;
  keyboardHeight: number;
};

const NAMED: Record<string, string> = { " ": "space", "\x7f": "backspace", "\r": "enter" };

export const TerminalInput = forwardRef<TerminalInputHandle, Props>(function TerminalInput({ sessionKey, route, terminal, keyboardHeight }, ref) {
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const message = settings.inputMode === "message";
  const [ctrl, setCtrl] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const capture = useRef<TextInput>(null);
  const mirror = useRef("");
  const latest = useRef("");
  const lastChange = useRef<Change | null>(null);
  const pendingSend = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fail = (e: unknown) => Alert.alert("Could not reach it", e instanceof Error ? e.message : String(e));
  const call = (method: string, params: object) => route.conn.call(method, { terminal: route.address, ...params });

  const resetMirror = () => {
    mirror.current = "";
    capture.current?.clear();
  };

  const cancelPendingSend = () => {
    if (pendingSend.current) clearTimeout(pendingSend.current);
    pendingSend.current = null;
  };

  const changeText = (next: string) => {
    latest.current = next;
    setText(next);
  };

  useEffect(() => {
    cancelPendingSend();
    changeText("");
    lastChange.current = null;
    setCtrl(false);
    resetMirror();
  }, [sessionKey]);

  useEffect(() => cancelPendingSend, []);

  /** Bytes to the terminal; false when it is not attached yet. */
  const write = (chars: string) => {
    terminal.current?.scrollToBottom();
    return !!terminal.current?.write(utf8Encode(chars));
  };

  const pressKey = (name: string) => {
    resetMirror();
    if (name === "paste") return void paste();
    if (ctrl && name.length === 1) {
      setCtrl(false);
      name = `ctrl+${name}`;
    }
    if (!write(keyBytes(name, terminal.current?.appCursor() ?? false))) call("terminal.keys", { keys: [name] }).catch(fail);
  };

  const typeRaw = (chars: string) => {
    if (!chars) return;
    let out = chars;
    const control = ctrl ? withCtrl(out) : null;
    if (control !== null) {
      out = control;
      setCtrl(false);
    }
    if (!write(out)) call("terminal.keys", { keys: [...out].map((c) => NAMED[c] ?? c) }).catch(fail);
  };

  // The clipboard as one paste: wrapped when the program asked for bracketed
  // paste, so a multi-line paste doesn't run line by line.
  const paste = async () => {
    const clip = (await Clipboard.getStringAsync()).replace(/\r?\n/g, "\r");
    if (!clip) return;
    const wrapped = terminal.current?.bracketedPaste() ? `\x1b[200~${clip}\x1b[201~` : clip;
    if (!write(wrapped)) call("terminal.send", { text: clip }).catch(fail);
  };

  const onCaptureChange = (next: string) => {
    const out = typedText(mirror.current, next);
    mirror.current = next;
    typeRaw(out);
    // The line went to the terminal: start the mirror over.
    if (out.includes("\r")) resetMirror();
  };

  // The keyboard's own Enter is an action key on Android (✓ or ⏎); it submits
  // instead of typing a newline.
  const onCaptureSubmit = () => {
    typeRaw("\r");
    resetMirror();
  };

  const send = async (message: string, force = false) => {
    cancelPendingSend();
    const body = message.trimEnd();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await call("terminal.send", { text: body, force });
      changeText("");
    } catch (e) {
      if (!force && e instanceof HcError && /block/i.test(`${e.kind} ${e.message}`)) {
        Alert.alert("It is waiting on a question", "Typing now may answer its dialog.", [
          { text: "Cancel", style: "cancel" },
          { text: "Send anyway", onPress: () => void send(body, true) },
        ]);
      } else fail(e);
    } finally {
      setSending(false);
    }
  };

  // Enter types a newline, and a lone newline the user typed sends. Dictation
  // apps paste line breaks as Enter too, but right after or right before a burst
  // of text; those stay as newlines in the message.
  const onMessageChange = (next: string) => {
    const now = Date.now();
    const prev = latest.current;
    cancelPendingSend();
    const message = withoutTypedNewline(prev, next);
    if (message !== null && enterSends(lastChange.current, now)) {
      pendingSend.current = setTimeout(() => void send(message), SEND_DELAY_MS);
    }
    lastChange.current = { at: now, grew: next.length - prev.length };
    changeText(next);
  };

  // Android keeps a hidden field focused after the keyboard is dismissed; blur
  // first so focusing opens the keyboard again.
  const openKeyboard = () => {
    if (message) return;
    const input = capture.current;
    if (!input) return;
    if (input.isFocused()) {
      input.blur();
      setTimeout(() => input.focus(), 60);
    } else input.focus();
  };

  useImperativeHandle(ref, () => ({ openKeyboard }));

  const setMode = (next: "direct" | "message") => {
    resetMirror();
    setCtrl(false);
    void updateSettings({ inputMode: next });
    if (next === "direct") setTimeout(openKeyboard, 80);
  };

  const bottom = keyboardHeight ? 0 : insets.bottom;

  return (
    <>
      <ScrollView horizontal style={styles.keybar} contentContainerStyle={styles.keybarContent} keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false}>
        <Key label="" icon={message ? "keypad-outline" : "chatbox-outline"} accessibilityLabel={message ? "Type directly" : "Write a message"} onPress={() => setMode(message ? "direct" : "message")} />
        {!message && keyboardHeight === 0 && <Key label="keyboard" onPress={openKeyboard} />}
        <Key label="ctrl" active={ctrl} onPress={() => setCtrl((c) => !c)} />
        {KEY_BAR.map((k) => (
          <Key key={k.label} label={k.label} onPress={() => pressKey(k.key)} />
        ))}
      </ScrollView>
      {message ? (
        <View style={[styles.composer, { paddingBottom: Math.max(bottom, space.sm) }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={onMessageChange}
            placeholder="Message"
            placeholderTextColor={colors.muted}
            autoCorrect
            spellCheck
            multiline
            submitBehavior="newline"
          />
          <Pressable style={[styles.send, (!text.trim() || sending) && styles.off]} disabled={!text.trim() || sending} onPress={() => void send(text)}>
            <Text style={styles.sendText}>{sending ? "…" : "Send"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ height: Math.max(bottom, keyboardHeight ? 0 : space.xs) }}>
          <TextInput
            ref={capture}
            style={styles.capture}
            defaultValue=""
            onChangeText={onCaptureChange}
            onSubmitEditing={onCaptureSubmit}
            submitBehavior="submit"
            returnKeyType="send"
            onKeyPress={(e) => e.nativeEvent.key === "Backspace" && mirror.current === "" && typeRaw("\x7f")}
            multiline
            autoCapitalize="none"
            autoCorrect
            autoComplete="off"
            spellCheck
            importantForAutofill="no"
            caretHidden
          />
        </View>
      )}
    </>
  );
});

function Key({ label, icon, onPress, active, accessibilityLabel }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; active?: boolean; accessibilityLabel?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [styles.key, active && styles.keyActive, pressed && styles.keyPressed]}
      onPress={onPress}
    >
      {icon ? <Ionicons name={icon} size={18} color={active ? colors.onAccent : colors.text} /> : <Text style={[styles.keyText, active && styles.keyTextActive]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  keybar: { flexGrow: 0, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  keybarContent: { padding: space.sm - 2, gap: space.sm - 2 },
  key: { minWidth: 40, paddingHorizontal: space.md - 2, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, alignItems: "center", justifyContent: "center" },
  keyActive: { backgroundColor: colors.accent },
  keyPressed: { backgroundColor: colors.border },
  keyText: { color: colors.text, fontSize: 15, fontFamily: fonts.mono },
  keyTextActive: { color: colors.onAccent, fontWeight: "700" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.sm, paddingTop: space.sm, backgroundColor: colors.surface },
  input: { flex: 1, maxHeight: 120, color: colors.text, backgroundColor: colors.bg, borderRadius: 18, paddingHorizontal: 14, paddingVertical: space.sm, fontSize: 15 },
  send: { backgroundColor: colors.accent, borderRadius: 18, paddingHorizontal: space.lg, height: 36, justifyContent: "center" },
  sendText: { color: colors.onAccent, fontWeight: "700" },
  off: { opacity: 0.4 },
  capture: { position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: 0, color: "transparent" },
});

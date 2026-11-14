// One mod copy on screen: it starts with the block, reloads when the mod's
// files change, draws its description, and shows its errors in a bar.
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { definition, useDefinition } from "../../definition/controller";
import { useAppData } from "../../mods/app-data";
import { ModCopy, type CopyState } from "../../mods/copy";
import type { EngineError } from "../../mods/engine";
import { nativeEngine } from "../../mods/engine-native";
import { hostCall } from "../../mods/host";
import { closeOverlay, openOverlay, toast } from "../../mods/overlays";
import { RUNTIME_FILES } from "../../mods/runtime.generated";
import { loadStorage, saveStorage, setShared } from "../../mods/shared";
import { Renderer } from "./Renderer";

/** "mods/prs/main.js:3: message", as .error files and the bar say it. */
export function describeError(mod: string, e: EngineError): string {
  const where = e.file ? `mods/${mod}/${e.file}${e.line ? `:${e.line}` : ""}` : `mods/${mod}`;
  return `${where}: ${e.message}`;
}

export function useModCopy(mod: string, props: Record<string, unknown>, copyId: string, overlay?: string): CopyState & { copy: ModCopy | null } {
  const [state, setState] = useState<CopyState>({ description: null, error: null });
  const copyRef = useRef<ModCopy | null>(null);
  const data = useAppData();
  const fullProps = useMemo(() => (overlay ? { ...props, overlay } : props), [props, overlay]);
  const dataRef = useRef({ ...data, props: fullProps });
  dataRef.current = useMemo(() => ({ ...data, props: fullProps }), [data, fullProps]);
  const def = useDefinition();
  const files = def.mods[mod]?.files;
  const filesJson = useMemo(() => (files ? JSON.stringify(files) : null), [files]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      setState({ description: null, error: { message: "mods need the native mod engine, which this platform doesn't have yet" } });
      return;
    }
    let alive = true;
    let copy: ModCopy | null = null;
    (async () => {
      const storage = await loadStorage(copyId);
      if (!alive) return;
      copy = new ModCopy(
        mod,
        {
          engine: nativeEngine,
          runtime: RUNTIME_FILES,
          call: hostCall,
          post(m) {
            switch (m.t) {
              case "overlay":
                openOverlay({ id: m.id, mod: m.mod, props: m.props, kind: m.kind === "dialog" ? "dialog" : "sheet", title: m.title });
                break;
              case "closeOverlay":
                closeOverlay(m.id ?? overlay ?? null);
                break;
              case "toast":
                toast(m);
                break;
              case "shared":
                setShared(m.key, m.value);
                break;
              case "storage":
                saveStorage(copyId, storage);
                break;
              case "log":
                console.log(`[mod ${mod}] ${m.text}`);
                break;
            }
          },
        },
        () => dataRef.current,
        storage,
        (s) => alive && setState(s),
      );
      copyRef.current = copy;
      const current = definition.current.mods[mod]?.files;
      if (!current) {
        setState({ description: null, error: { message: `there is no mod named ${mod} in mods/` } });
        return;
      }
      if (await copy.load(current)) definition.markModGood(mod, current);
      else {
        const good = definition.goodModFiles(mod);
        if (good && JSON.stringify(good) !== JSON.stringify(current)) {
          const error = copy.current.error;
          if (await copy.load(good)) setState({ ...copy.current, error });
        }
      }
    })();
    return () => {
      alive = false;
      copyRef.current = null;
      void copy?.close();
    };
  }, [mod, copyId, overlay]);

  // A save: reload in place; a broken one keeps the running build.
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    const copy = copyRef.current;
    if (!copy || !filesJson || loaded.current === null) {
      loaded.current = filesJson;
      return;
    }
    if (loaded.current === filesJson) return;
    loaded.current = filesJson;
    const f = JSON.parse(filesJson);
    void copy.load(f).then((ok) => ok && definition.markModGood(mod, f));
  }, [filesJson, mod]);

  useEffect(() => {
    copyRef.current?.dataChanged();
  }, [dataRef.current]);

  useEffect(() => {
    definition.setModError(mod, state.error ? describeError(mod, state.error) : null);
  }, [state.error, mod]);

  return { ...state, copy: copyRef.current };
}

export function ModBlock({ mod, props, copyId, overlay, style }: { mod: string; props: Record<string, unknown>; copyId: string; overlay?: string; style?: StyleProp<ViewStyle> }) {
  const { description, error, copy } = useModCopy(mod, props, copyId, overlay);
  const data = useAppData();
  const t = data.theme;
  return (
    <View style={style}>
      {error && (
        <Pressable
          style={[styles.bar, { backgroundColor: t.blocked + "22", borderColor: t.blocked }]}
          onPress={() => copy?.dismissError()}
          onLongPress={() => void Clipboard.setStringAsync(describeError(mod, error))}
          accessibilityRole="button"
          accessibilityLabel={`Mod error: ${describeError(mod, error)}. Tap to hide.`}
        >
          <Text style={[styles.barText, { color: t.foreground }]} numberOfLines={3}>
            {describeError(mod, error)}
          </Text>
        </Pressable>
      )}
      {description !== null && <Renderer node={description} fire={(cb, ev) => copy?.event(cb, ev)} text={{ color: t.foreground, fontSize: 14 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderWidth: 1, borderRadius: 8, margin: 8, paddingHorizontal: 10, paddingVertical: 8 },
  barText: { fontSize: 12, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
});

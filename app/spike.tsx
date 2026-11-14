// Phase 1 spike: times the native mod engine on a phone and draws its
// description. Open with herdrmobile:///spike. Phase 5 replaces it.
import { File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { ModEngine, type EngineResult } from "../modules/mod-engine";
import { BRANCH_SVG, PI_SVG, SPIKE_FILES, spikeData } from "../src/mods/spike";
import { colors } from "../src/ui/theme";

type Node = { t: "text"; text: string } | { t: "box"; dir: "row" | "column"; style: Record<string, any>; click?: number; children: Node[] };

const TEXT_KEYS = ["color", "fontSize", "fontWeight"];
const ID = "spike";

function split(style: Record<string, any>, inherited: TextStyle): [ViewStyle, TextStyle] {
  const view: Record<string, any> = {};
  const text: Record<string, any> = { ...inherited };
  for (const [k, v] of Object.entries(style)) (TEXT_KEYS.includes(k) ? text : view)[k] = v;
  return [view, text];
}

function Draw({ node, text, onClick }: { node: Node; text: TextStyle; onClick: (id: number) => void }) {
  if (node.t === "text") return <Text style={text}>{node.text}</Text>;
  const [view, inner] = split(node.style, text);
  const kids = node.children.map((c, i) => <Draw key={i} node={c} text={inner} onClick={onClick} />);
  const style = { flexDirection: node.dir, ...view } as ViewStyle;
  if (node.click === undefined) return <View style={style}>{kids}</View>;
  const id = node.click;
  return <Pressable style={style} onPress={() => onClick(id)}>{kids}</Pressable>;
}

const ms = (n: number) => `${n.toFixed(1)} ms`;
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];

function unwrap<T>(r: EngineResult<T>): T {
  if (!r.ok) throw new Error(`${r.error.file ?? ""}:${r.error.line ?? ""} ${r.error.message}`);
  return r.value;
}

export default function Spike() {
  const [tree, setTree] = useState<Node | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [icons, setIcons] = useState<{ pi: string; branch: string } | null>(null);
  const busy = useRef(false);
  const say = (line: string) => setLog((l) => [...l, line]);

  const render = async () => {
    const t0 = performance.now();
    const node = unwrap(await ModEngine.call<Node>(ID, "render"));
    return { node, took: performance.now() - t0 };
  };

  useEffect(() => {
    const pi = new File(Paths.cache, "spike-pi.svg");
    const branch = new File(Paths.cache, "spike-branch-tinted.svg");
    pi.write(PI_SVG);
    // Android's SVG decoder draws currentColor black and doesn't tint it: substitute.
    branch.write(BRANCH_SVG.replaceAll("currentColor", colors.text));
    setIcons({ pi: pi.uri, branch: branch.uri });

    (async () => {
      try {
        const t0 = performance.now();
        await ModEngine.create(ID);
        const load = await ModEngine.load(ID, SPIKE_FILES, "__boot.js");
        if (!load.ok) throw new Error(`${load.error.file}:${load.error.line} ${load.error.message}`);
        unwrap(await ModEngine.call(ID, "init", [{}]));
        unwrap(await ModEngine.call(ID, "data", [spikeData()]));
        const { node } = await render();
        setTree(node);
        say(`load: create + load + init + data + first render = ${ms(performance.now() - t0)}`);
      } catch (e) {
        say(`load failed: ${String(e)}`);
      }
    })();
    return () => void ModEngine.dispose(ID);
  }, []);

  const rerender = async () => {
    if (busy.current) return;
    busy.current = true;
    const times: number[] = [];
    let last: Node | null = null;
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      unwrap(await ModEngine.call(ID, "data", [spikeData(i)]));
      last = (await render()).node;
      times.push(performance.now() - t0);
    }
    setTree(last);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    say(`re-render ×50 (data + render, round trip): mean ${ms(mean)}, p95 ${ms(p95(times))}, max ${ms(Math.max(...times))}`);
    busy.current = false;
  };

  const breakdown = async () => {
    if (busy.current) return;
    busy.current = true;
    const time = async (n: number, f: () => Promise<unknown>) => {
      const xs: number[] = [];
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        await f();
        xs.push(performance.now() - t0);
      }
      return `mean ${ms(xs.reduce((a, b) => a + b, 0) / n)}, p95 ${ms(p95(xs))}`;
    };
    const data = spikeData(3);
    const desc = JSON.stringify(tree);
    say(`ping (empty call): ${await time(50, () => ModEngine.call(ID, "init", [{}]))}`);
    say(`data only: ${await time(50, () => ModEngine.call(ID, "data", [data]))}`);
    say(`render only: ${await time(50, () => ModEngine.call(ID, "render"))}`);
    say(`Hermes JSON.parse of the ${desc.length} B description: ${await time(50, async () => JSON.parse(desc))}`);
    busy.current = false;
  };

  const tap = async (id: number) => {
    const t0 = performance.now();
    const ev = await ModEngine.call(ID, "event", [id, null]);
    unwrap(ev);
    const { node } = await render();
    setTree(node);
    say(`tap → new description: ${ms(performance.now() - t0)} (outbox ${JSON.stringify(ev.outbox)})`);
  };

  const runaway = async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 10);
    const t0 = performance.now();
    const r = await ModEngine.call(ID, "spin");
    const took = performance.now() - t0;
    clearInterval(timer);
    say(`run away: stopped after ${ms(took)}, "${r.ok ? "not stopped" : r.error.message}"; JS thread ticked ${ticks}× meanwhile (10 ms timer)`);
    say(`after run away: ${(await ModEngine.call(ID, "render")).ok ? "engine still renders" : "engine broken"}`);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Mod engine spike" }} />
      <View style={styles.bar}>
        <Pressable style={styles.button} onPress={rerender} accessibilityRole="button"><Text style={styles.label}>Re-render ×50</Text></Pressable>
        <Pressable style={styles.button} onPress={runaway} accessibilityRole="button"><Text style={styles.label}>Run away</Text></Pressable>
        <Pressable style={styles.button} onPress={breakdown} accessibilityRole="button"><Text style={styles.label}>Breakdown</Text></Pressable>
        {icons && <Image source={{ uri: icons.pi }} style={styles.icon} tintColor={colors.accent} accessibilityLabel="pi svg" />}
        {icons && <Image source={{ uri: icons.branch }} style={styles.icon} tintColor={colors.text} accessibilityLabel="branch svg" />}
      </View>
      <View style={styles.log}>{log.map((l, i) => <Text key={i} style={styles.logLine}>{l}</Text>)}</View>
      <ScrollView style={styles.flex} testID="spike-list">
        {tree && <Draw node={tree} text={{ color: colors.text, fontSize: 14 }} onClick={tap} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  bar: { flexDirection: "row", gap: 8, padding: 8, alignItems: "center" },
  button: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  label: { color: colors.text },
  icon: { width: 24, height: 24 },
  log: { paddingHorizontal: 8, gap: 2 },
  logLine: { color: colors.muted, fontSize: 12 },
});

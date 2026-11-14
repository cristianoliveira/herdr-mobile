// Sizes a new terminal to the phone before anything draws it, so its first
// screen fits when it opens.
import { fleet } from "../fleet-store";
import { getSettings } from "../settings";
import { lastFitSize } from "./fit";

export async function presize(key: string) {
  const size = lastFitSize();
  if (!size || getSettings().defaultMode !== "fit") return;
  const start = Date.now();
  let route = fleet.route(key);
  while (!route && Date.now() - start < 2000) {
    await new Promise((r) => setTimeout(r, 50));
    route = fleet.route(key);
  }
  if (!route) return;
  try {
    const stream = await route.conn.attach({ terminal: route.address, cols: size.cols, rows: size.rows, history: 0 }, { onData: () => {}, onClose: () => {} });
    stream.resize(size.cols, size.rows);
    stream.close();
  } catch {}
}

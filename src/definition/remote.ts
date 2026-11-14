// The definition machine as DefinitionSync needs it: commands and files,
// through its core.
import { fromBase64, toBase64, utf8Decode, utf8Encode } from "../hc/bytes";
import type { Fleet, Target } from "../hc/fleet";

export type Remote = {
  exec(argv: string[]): Promise<{ code: number | null; stdout: string; stderr: string }>;
  /** A text file; throws when it's missing or not text. */
  read(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  /** Replaces the whole file, making folders. */
  write(path: string, content: string | Uint8Array): Promise<void>;
};

export function remoteOf(fleet: Fleet, target: Target): Remote {
  return {
    exec: (argv) => fleet.exec(target, argv),
    async read(path) {
      const r = await fleet.call<{ text: string }>(target, "file.read", { path });
      return r.text;
    },
    async readBytes(path) {
      const r = await fleet.execBytes(target, ["cat", path]);
      if (r.code !== 0) throw new Error(utf8Decode(r.stderr).trim() || `cannot read ${path}`);
      return r.stdout;
    },
    async write(path, content) {
      const bytes = typeof content === "string" ? utf8Encode(content) : content;
      await fleet.call(target, "file.write", { path, data: toBase64(bytes) });
    },
  };
}

export { fromBase64 };

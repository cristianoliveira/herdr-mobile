// POSIX cksum (the CRC the definition machine's `cksum` prints), so the
// phone can compare what it ships with what's there without reading it.
import { utf8Encode } from "../hc/bytes";

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 24;
    for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function cksum(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? utf8Encode(input) : input;
  let crc = 0;
  const step = (b: number) => {
    crc = ((crc << 8) ^ TABLE[((crc >>> 24) ^ b) & 0xff]) >>> 0;
  };
  for (const b of bytes) step(b);
  for (let n = bytes.length; n > 0; n = Math.floor(n / 256)) step(n & 0xff);
  return `${~crc >>> 0} ${bytes.length}`;
}

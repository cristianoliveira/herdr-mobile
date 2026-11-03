// The message composer: telling an Enter the user pressed from line breaks a
// dictation app pastes. No React Native imports, so tests run in Node.

/** A burst grows the text by more than this many characters at once. */
const BURST_CHARS = 3;
/** Enter this soon after a burst belongs to it. */
const BURST_MS = 200;
/** Text arriving this soon after Enter means the Enter was part of a paste. */
export const SEND_DELAY_MS = 150;

/** The text without the newline when next is prev with one newline typed into it, else null. */
export function withoutTypedNewline(prev: string, next: string): string | null {
  if (next.length !== prev.length + 1) return null;
  let i = 0;
  while (i < prev.length && prev[i] === next[i]) i++;
  if (next[i] !== "\n" || next.slice(i + 1) !== prev.slice(i)) return null;
  return prev;
}

export type Change = { at: number; grew: number };

/**
 * Whether an Enter typed at `now` should send the message: false when it came
 * right after a burst of inserted text, as dictation pastes paragraphs.
 */
export function enterSends(last: Change | null, now: number): boolean {
  return !last || last.grew <= BURST_CHARS || now - last.at >= BURST_MS;
}

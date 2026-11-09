import AsyncStorage from "@react-native-async-storage/async-storage";

export type Snippet = { name: string; text: string };
export const SNIPPET_NAME_LIMIT = 60;
export const SNIPPET_TEXT_LIMIT = 10000;
const KEY = "terminal-snippets.v1";

function validate(value: unknown): asserts value is Snippet[] {
  if (!Array.isArray(value)) throw new Error("Invalid saved snippets.");
  const names = new Set<string>();
  for (const item of value) {
    if (!item || typeof item.name !== "string" || typeof item.text !== "string") throw new Error("Invalid saved snippet.");
    if (!item.name.trim() || item.name.length > SNIPPET_NAME_LIMIT) throw new Error("Use a name of 1–60 characters.");
    if (!item.text.trim() || item.text.length > SNIPPET_TEXT_LIMIT) throw new Error("Use text of 1–10,000 characters.");
    // Snippets are text, not escape sequences or keyboard macros.
    if (/[\x00-\x08\x0b-\x1f\x7f]/.test(item.text) || /[\x00-\x1f\x7f]/.test(item.name)) throw new Error("Snippets cannot contain control characters.");
    if (names.has(item.name.trim())) throw new Error("Choose a different snippet name.");
    names.add(item.name.trim());
  }
}

export async function loadSnippets(): Promise<Snippet[]> {
  const raw = await AsyncStorage.getItem(KEY);
  const snippets: unknown = raw === null ? [] : JSON.parse(raw);
  validate(snippets);
  return snippets;
}

export async function saveSnippets(snippets: Snippet[]): Promise<void> {
  validate(snippets);
  await AsyncStorage.setItem(KEY, JSON.stringify(snippets));
}

export function appendSnippet(draft: string, text: string): string {
  return draft + (draft && !draft.endsWith("\n") ? "\n" : "") + text;
}

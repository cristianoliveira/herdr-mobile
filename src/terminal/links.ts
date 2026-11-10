const MAX_URL_LENGTH = 4096;

type LinkMessage = { type: "link"; url: string };
type VisibleLinksMessage = { type: "links"; id: string; urls: string[] };

type ExternalUrlOpener = (url: string) => Promise<unknown>;

export function parseVisibleLinksMessage(raw: string, expectedId: string): string[] | null {
  if (raw.length > 100_000) return null;

  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;

  const candidate = message as Partial<VisibleLinksMessage>;
  if (
    Object.keys(candidate).length !== 3 ||
    candidate.type !== "links" ||
    candidate.id !== expectedId ||
    !Array.isArray(candidate.urls) ||
    candidate.urls.length > 100 ||
    candidate.urls.some((url) => typeof url !== "string")
  ) return null;

  return [...new Set(candidate.urls.map((url) => {
    return parseExternalLinkMessage(JSON.stringify({ type: "link", url }));
  }).filter((url): url is string => url !== null))];
}

export function displayLinkTarget(raw: string): string {
  const url = new URL(raw);
  const target = `${url.origin}${url.pathname}${url.search ? "?…" : ""}`;
  return target.length <= 120 ? target : `${target.slice(0, 117)}…`;
}

export function parseExternalLinkMessage(raw: string): string | null {
  if (raw.length > MAX_URL_LENGTH + 128) return null;

  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!message || typeof message !== "object") return null;
  const candidate = message as Partial<LinkMessage>;
  if (
    Object.keys(candidate).length !== 2 ||
    candidate.type !== "link" ||
    typeof candidate.url !== "string"
  ) return null;
  if (!candidate.url || candidate.url.length > MAX_URL_LENGTH) return null;

  try {
    const url = new URL(candidate.url);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

export async function openExternalLink(
  raw: string,
  openUrl: ExternalUrlOpener,
  onFailure: () => void,
): Promise<boolean> {
  const url = parseExternalLinkMessage(JSON.stringify({ type: "link", url: raw }));
  if (!url) return false;

  try {
    await openUrl(url);
    return true;
  } catch {
    onFailure();
    return false;
  }
}

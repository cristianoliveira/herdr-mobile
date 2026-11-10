const MAX_URL_LENGTH = 4096;

type LinkMessage = { type: "link"; url: string };

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

// svg(path) and image(path): files in the home, drawn with expo-image from a
// cached copy. Shipped icons come with the app; a mod's own come from the
// definition. Android's SVG decoder draws currentColor black and doesn't tint
// it, so a tinted SVG gets its currentColor replaced before caching.
import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { useMemo } from "react";
import { definition } from "../../definition/controller";
import { cksum } from "../../definition/cksum";
import { DEFAULT_FILES } from "../../definition/defaults.generated";

const dir = new Directory(Paths.cache, "mod-assets");

function uriOf(path: string, tint: string | undefined): string | null {
  const content = definition.file(path) ?? DEFAULT_FILES[path];
  if (content === undefined) return null;
  if (content.startsWith("data:")) return content;
  const svg = tint ? content.split("currentColor").join(tint) : content;
  const file = new File(dir, `${cksum(svg).replace(" ", "-")}.svg`);
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    if (!file.exists) file.write(svg);
  } catch {
    return null;
  }
  return file.uri;
}

export function Asset({ path, tint, size, style }: { path: string; tint?: string; size?: number; style?: any }) {
  const uri = useMemo(() => uriOf(path, tint), [path, tint]);
  const w = style?.width ?? size ?? 16;
  const h = style?.height ?? size ?? 16;
  if (!uri) return null;
  return <Image source={{ uri }} style={[style, { width: w, height: h }]} tintColor={tint} contentFit="contain" />;
}

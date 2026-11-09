export type ProjectLayout = "direct" | "grouped";

export function projectPathError(path: string): string | null {
  if (!path || /[\x00-\x1f\x7f]/.test(path)) return "Enter a path without line breaks or control characters.";
  if (path !== "~" && !path.startsWith("~/") && !path.startsWith("/")) return "Use an absolute path or a path starting with ~/.";
  return null;
}

/** Paths are shell arguments, never shell source. Home belongs to the remote machine. */
export function projectProbe(path: string, layout: ProjectLayout): string[] {
  const error = projectPathError(path);
  if (error) throw new Error(error);
  return ["sh", "-c", `
case "$1" in
  '~') root="$HOME" ;;
  '~/'*) root="$HOME/\${1#??}" ;;
  *) root="$1" ;;
esac
cd "$root" || exit 1
root="$(pwd -P)"
printf '%s\\n' "$root"
if [ "$2" = grouped ]; then
  set -- "$root"/*/*
else
  set -- "$root"/*
fi
for d do
  [ -d "$d" ] && printf '%s\\n' "\${d#"$root"/}"
done
true
`, "herdr-projects", path, layout];
}

export async function scanProjectPaths(
  paths: string[],
  layout: ProjectLayout,
  exec: (argv: string[]) => Promise<{ code: number | null; stdout: string }>,
) {
  const results = await Promise.all(paths.map(async (path) => {
    try {
      const output = await exec(projectProbe(path, layout));
      if (output.code !== 0) throw new Error("Could not read project path");
      return { projects: readProjects(output.stdout), error: null };
    } catch {
      return { projects: [], error: path };
    }
  }));
  const projects = new Map<string, ReturnType<typeof readProjects>[number]>();
  for (const result of results) {
    for (const project of result.projects) projects.set(project.folder, project);
  }
  return {
    projects: [...projects.values()],
    errors: results.flatMap((result) => result.error === null ? [] : [result.error]),
  };
}

export function readProjects(output: string): { owner: string; repo: string; folder: string }[] {
  const [root, ...paths] = output.split("\n").filter(Boolean);
  if (!root) return [];
  return paths.map((path) => {
    const parts = path.split("/");
    const repo = parts.pop()!;
    return { owner: parts.join("/"), repo, folder: `${root.replace(/\/$/, "")}/${path}` };
  });
}

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ALPHA = /^v(\d+\.\d+\.\d+)-alpha\.([1-9]\d*)$/;

/** Choose the next alpha, or validate a tag that triggered the workflow. */
export function alphaTag(version, requested, existing) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("app.json must have an X.Y.Z version.");
  if (requested) {
    if (ALPHA.exec(requested)?.[1] !== version) throw new Error(`Use an alpha tag for app version ${version}.`);
    return requested;
  }
  const numbers = existing.map((tag) => ALPHA.exec(tag)).filter((match) => match?.[1] === version).map((match) => Number(match[2]));
  const next = Math.max(0, ...numbers) + 1;
  if (!Number.isSafeInteger(next)) throw new Error("Alpha tag number is too large.");
  return `v${version}-alpha.${next}`;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { expo } = JSON.parse(readFileSync("app.json", "utf8"));
  const requested = process.env.REQUESTED_RELEASE_TAG ?? "";
  const tags = execFileSync("git", ["tag", "--list"], { encoding: "utf8" }).trim().split("\n");
  const tag = alphaTag(expo.version, requested, tags);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (tags.includes(tag)) {
    const tagged = execFileSync("git", ["rev-parse", `refs/tags/${tag}^{commit}`], { encoding: "utf8" }).trim();
    if (tagged !== commit) throw new Error("Release tag does not identify the checked-out commit.");
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\ncommit=${commit}\n`);
  appendFileSync(process.env.GITHUB_ENV, `RELEASE_TAG=${tag}\n`);
  console.log(`Building ${tag} from ${commit}`);
}

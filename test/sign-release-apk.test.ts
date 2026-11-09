import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, beforeEach, expect, test } from "vitest";

let root: string;
let env: NodeJS.ProcessEnv;
let input: string;
let output: string;
let log: string;
const script = resolve("scripts/sign-release-apk.sh");
const alphaScript = resolve("scripts/sign-alpha-apk.sh");
const template = resolve("node_modules/expo/template.tgz");
const stub = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.SIGN_TEST_LOG, JSON.stringify([require('node:path').basename(process.argv[1]), ...args]) + '\\n');
if (process.env.SIGN_TEST_FAILURE === args[0]) process.exit(1);
if (require('node:path').basename(process.argv[1]) === 'zipalign') fs.copyFileSync(args.at(-2), args.at(-1));
else if (args[0] === 'sign') fs.writeFileSync(args[args.indexOf('--out') + 1], 'signed apk');
`;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "herdr signing ")));
  const tools = join(root, "sdk", "build-tools", "36.0.0");
  mkdirSync(tools, { recursive: true });
  for (const name of ["zipalign", "apksigner"]) {
    writeFileSync(join(tools, name), stub);
    chmodSync(join(tools, name), 0o755);
  }
  input = join(root, "input's $(touch injected).apk");
  output = join(root, "output dir", "release.apk");
  log = join(root, "commands.jsonl");
  const key = join(root, "release key.jks");
  writeFileSync(input, "build apk");
  writeFileSync(key, "test key");
  env = { ...process.env, ANDROID_HOME: join(root, "sdk"), ANDROID_KEYSTORE_FILE: key,
    ANDROID_KEYSTORE_PASSWORD: "test-store-password", ANDROID_KEY_ALIAS: "release",
    ANDROID_KEY_PASSWORD: "test-key-password", SIGN_TEST_LOG: log, SIGN_TEST_FAILURE: "" };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function sign(extra: Partial<NodeJS.ProcessEnv> = {}) {
  return spawnSync("bash", [script, input, output], { env: { ...env, ...extra }, encoding: "utf8", timeout: 10000 });
}

function commands(): string[][] {
  return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
}

test("aligns, signs, and verifies an APK with literal paths and environment-based passwords", () => {
  const result = sign();

  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(output, "utf8")).toBe("signed apk");
  const calls = commands();
  expect(calls.map((c) => c[0])).toEqual(["zipalign", "apksigner", "apksigner"]);
  expect(calls[1]).toContain("env:ANDROID_KEYSTORE_PASSWORD");
  expect(calls[1]).toContain("env:ANDROID_KEY_PASSWORD");
  expect(calls[2].slice(1)).toEqual(["verify", "--verbose", "--print-certs", output]);
  expect(JSON.stringify(calls)).not.toContain("test-store-password");
  expect(existsSync(join(root, "injected"))).toBe(false);
});

test.each(["ANDROID_KEYSTORE_FILE", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"])("rejects missing %s before invoking build tools", (name) => {
  const result = sign({ [name]: "" });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(name);
  expect(commands()).toEqual([]);
  expect(existsSync(output)).toBe(false);
});

test("rejects a missing keystore before signing", () => {
  const result = sign({ ANDROID_KEYSTORE_FILE: join(root, "missing.jks") });

  expect(result.status).not.toBe(0);
  expect(commands()).toEqual([]);
});

test("does not overwrite an existing release APK", () => {
  mkdirSync(join(root, "output dir"));
  writeFileSync(output, "previous signed release");

  const result = sign();

  expect(result.status).not.toBe(0);
  expect(readFileSync(output, "utf8")).toBe("previous signed release");
  expect(commands()).toEqual([]);
});

test("reports missing Android signing tools before producing output", () => {
  rmSync(join(env.ANDROID_HOME!, "build-tools", "36.0.0", "apksigner"));

  const result = sign();

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("sdkmanager");
  expect(existsSync(output)).toBe(false);
});

function signAlpha(key: Buffer) {
  mkdirSync(join(root, "android", "app"), { recursive: true });
  writeFileSync(join(root, "android", "app", "debug.keystore"), key);
  return spawnSync("bash", [alphaScript, input, output], {
    cwd: root,
    env: { ...env, ANDROID_KEYSTORE_FILE: "", ANDROID_KEYSTORE_PASSWORD: "", ANDROID_KEY_ALIAS: "", ANDROID_KEY_PASSWORD: "" },
    encoding: "utf8", timeout: 10000,
  });
}

test("alpha reuses Expo’s pinned public test key without user signing credentials", () => {
  const key = execFileSync("tar", ["-xOf", template, "package/android/app/debug.keystore"]);

  const result = signAlpha(key);

  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(output, "utf8")).toBe("signed apk");
  const calls = commands();
  expect(calls[1]).toContain(join(root, "android", "app", "debug.keystore"));
  expect(calls[1]).toContain("androiddebugkey");
  expect(calls[2][1]).toBe("verify");
});

test("alpha refuses a changed test key instead of silently breaking APK upgrades", () => {
  const result = signAlpha(Buffer.from("a different key"));

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("test keystore changed");
  expect(commands()).toEqual([]);
  expect(existsSync(output)).toBe(false);
});

test.each(["sign", "verify"])("removes output when APK %s fails", (failure) => {
  const result = sign({ SIGN_TEST_FAILURE: failure });

  expect(result.status).not.toBe(0);
  expect(existsSync(output)).toBe(false);
});

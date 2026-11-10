import { createRequire } from "node:module";
import { afterEach, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);
const configure = require("../app.config.js");
const { expo } = require("../app.json");
const withAlphaGradleMemory = require("../plugins/with-alpha-gradle-memory.js");

afterEach(() => vi.unstubAllEnvs());

test("default builds preserve the existing development and preview identity", () => {
  vi.stubEnv("HERDR_VARIANT", "");

  const result = configure({ config: expo });

  expect(result).toBe(expo);
  expect(result.android.package).toBe("dev.juanibiapina.herdrmobile");
  expect(result.updates.enabled).not.toBe(false);
});

test("alpha uses a separate identity and does not load preview OTA updates", () => {
  vi.stubEnv("HERDR_VARIANT", "alpha");
  const before = structuredClone(expo);

  const result = configure({ config: expo });

  expect(result.name).toBe("Herdr Alpha");
  expect(result.scheme).toBe("herdrmobile-alpha");
  expect(result.android.package).toBe("dev.juanibiapina.herdrmobile.alpha");
  expect(result.ios.bundleIdentifier).toBe("dev.juanibiapina.herdrmobile.alpha");
  expect(result.updates.enabled).toBe(false);
  expect(result.plugins).toEqual([
    ...expo.plugins,
    "./plugins/with-alpha-gradle-memory",
  ]);
  expect(result.android.permissions).toEqual(expo.android.permissions);
  expect(expo).toEqual(before);
});

test("alpha Gradle memory config replaces the generated JVM args property", () => {
  const properties = [
    {
      type: "property",
      key: "org.gradle.jvmargs",
      value: "-Xmx2048m -XX:MaxMetaspaceSize=512m",
    },
    { type: "property", key: "android.useAndroidX", value: "true" },
  ];

  const result = withAlphaGradleMemory.setGradleProperty(
    properties,
    "org.gradle.jvmargs",
    "-Xmx2048m -XX:MaxMetaspaceSize=1024m",
  );

  expect(result).toEqual([
    {
      type: "property",
      key: "org.gradle.jvmargs",
      value: "-Xmx2048m -XX:MaxMetaspaceSize=1024m",
    },
    { type: "property", key: "android.useAndroidX", value: "true" },
  ]);
});

test("unknown build variants fail instead of overwriting a regular installation", () => {
  vi.stubEnv("HERDR_VARIANT", "alhpa");

  expect(() => configure({ config: expo })).toThrow("Unknown HERDR_VARIANT");
});

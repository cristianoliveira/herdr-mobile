/** Keep alpha APKs separate from development and preview installations. */
module.exports = ({ config }) => {
  const variant = process.env.HERDR_VARIANT;
  if (variant && variant !== "alpha") throw new Error(`Unknown HERDR_VARIANT: ${variant}`);
  if (variant !== "alpha") return config;

  return {
    ...config,
    name: "Herdr Alpha",
    scheme: "herdrmobile-alpha",
    android: { ...config.android, package: `${config.android.package}.alpha` },
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.alpha` },
    // Alpha releases are snapshots: installing an APK is the only update path.
    updates: { ...config.updates, enabled: false },
  };
};

# herdr-mobile

Android and iOS client for herdr-core (`hc`), built with Expo.

- Check: `pnpm test` (needs `hc` on PATH) and `pnpm typecheck`.
- A push to `main` publishes an over-the-air update to every installed preview app. Land only finished, checked work there.
- The USB Pixel 7 on `mini` runs only the development client. Never install a preview or production APK on it. See docs/pixel-7.md.
- Build APKs locally with `eas build --local` in the Nix Android shell. Run a cloud build only when asked. See docs/releasing.md.

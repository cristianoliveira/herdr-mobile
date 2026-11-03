# herdr-mobile

Android and iOS client for herdr-core (`hc`), built with Expo. See README.md.

- Check: `pnpm test` (needs `hc` on PATH) and `pnpm typecheck`.
- The USB Pixel 7 on `mini` runs only the development client. Never install a preview or production APK on it. See "Run on the Pixel 7" in README.md.
- Build APKs locally with `eas build --local` in the Nix Android shell. Run a cloud build only when asked.

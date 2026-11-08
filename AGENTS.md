# herdr-mobile

Android and iOS client for herdr-core (`hc`), built with Expo.

## Mobile-first experience

- Design a native mobile experience, not a desktop interface squeezed onto a phone.
- Keep content primary. Put secondary actions in contextual menus or bottom sheets instead of permanent toolbars and per-row buttons.
- Prefer familiar gestures: swipe to reveal reversible actions; long-press to enter multi-selection. Show batch controls only during selection.
- Keep normal taps, vertical scrolling, and platform back gestures predictable. Never make gestures compete for the same motion.
- Provide accessible alternatives to every gesture and touch targets of at least 48 × 48 points.
- Make dismissal reversible with Undo. Hiding an item must not stop or delete the underlying work. Confirm destructive or broad bulk actions and state their scope.
- Judge interaction and spacing on a phone or emulator, not only in a desktop preview.

## Development constraints

- Check: `pnpm test` (needs `hc` on PATH) and `pnpm typecheck`.
- A push to `main` publishes an over-the-air update to every installed preview app. Land only finished, checked work there.
- The USB Pixel 7 on `mini` runs only the development client. Never install a preview or production APK on it. See docs/pixel-7.md.
- Build APKs locally with `eas build --local` in the Nix Android shell. Run a cloud build only when asked. See docs/releasing.md.

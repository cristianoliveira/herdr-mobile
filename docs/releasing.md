# Releasing

There are two paths. Pick by what changed (see
[development.md](development.md#javascript-and-native-changes)).

## JavaScript change: push to `main`

CI (`.github/workflows/ci.yml`) runs typecheck and tests, then publishes an
update to the EAS `preview` channel, which the APK is built to follow. A push
that changes only the repo's docs (top-level Markdown and `docs/`) publishes
nothing; the shipped home's Markdown is app content and does publish. Updates are published for
Android only. CI needs the `EXPO_TOKEN` repository secret. When CI is down,
publish by hand:

```sh
pnpm run publish:update --message "what changed"
```

A push with a native change publishes under its new fingerprint, which only
an APK built from that code loads.

## Native change: build a new APK

The runtime version is a fingerprint of the native inputs, so an update can
never load on an APK built from different native code. `npx expo-updates
runtimeversion:resolve --platform android` prints the current fingerprint;
when it differs from the installed APK's (Settings shows which code is
running), build a new APK.

### Build an APK

Build it locally in the Android dev shell from `juanibiapina/dotfiles`. Cloud
builds (`eas build` without `--local`) use the free plan's 15 monthly Android
builds; run one only when asked.

```sh
export NIXPKGS_ACCEPT_ANDROID_SDK_LICENSE=1
nix develop ~/workspace/juanibiapina/dotfiles#android --command bash -c \
  'pnpm exec eas build --platform android --profile preview --local \
     --non-interactive --output /tmp/herdr-mobile-v0.2.0-preview.apk'
```

Every build, local or cloud, is signed with the EAS keystore, so a new APK
installs over any earlier one. Builds signed with the debug key (before
November 2026) must be uninstalled first.

### Publish to Drive

Publish it to the `Herdr Mobile releases` Drive folder, which keeps exactly one
APK. Upload and share the new one before deleting the old one:

```sh
FOLDER=1kpy8XqZVcy9r0JOvXgYKt9bZ-QDF7wDf
gog drive upload /tmp/herdr-mobile-v0.2.0-preview.apk --parent "$FOLDER"
gog drive share <newFileId> --to anyone --force
gog drive ls --parent "$FOLDER"
gog drive delete <oldFileId> --force
```

# Herdr Mobile

An Android and iOS client for [herdr-core](https://github.com/herdrdev/herdr-core) (`hc`).

- **Agents:** every session on your machines, grouped the way Herdr's Agents
  panel groups them: what needs you, what is idle waiting for your next
  message, what is working, and plain terminals.
- **Switching:** inside a session, a strip of every session across the top,
  a "waiting" button that jumps to the next agent waiting on you, and the full
  list from the title.
- **Terminal:** live, in color, at phone size or your desktop's size (switch
  in the ⋯ menu). Swipe to scroll its history, or a full-screen program. Tap
  it and type: keys go straight to the terminal, and the keyboard suggests and
  corrects words as in any app. The key bar
  sends esc, tab, arrows, ctrl combinations and the clipboard instantly.
  Message mode is for prose to agents: Enter sends it, and hc pastes it and
  presses Enter.
- **Start sessions:** pick a machine (also one reached through another), browse
  to a folder, and start a shell, an installed agent (Claude Code, pi, Codex, …),
  a template, or any command, with an optional first task.
- **Manage:** interrupt, kill, keep alive, remove finished sessions.
- **Notifications:** when an agent needs you, finishes a turn, or exits, also
  with the app closed (a quiet foreground notification keeps it connected).

## How it connects

The phone reaches each machine the way hc reaches a machine it adds: SSH, then
`herdr-core connect`, which speaks the hc API over stdin/stdout. Nothing new
runs on your machines. The phone makes its own Ed25519 key; add its public key
(Settings → Machines → Copy) to `~/.ssh/authorized_keys` on each machine. The first
host key a machine presents is trusted and pinned.

The phone connects to every machine you add and merges their lists. A machine
that another one added with `hc machine add` shows up through it too, as hc's
`ls` would show it; when the phone also reaches that machine directly, each
terminal is listed once and the direct line is used.


## Develop

```sh
pnpm install          # also builds the terminal page (xterm.js inlined)
pnpm test             # protocol and multi-machine tests against real scratch hc cores
pnpm typecheck
```

The tests need `hc` on `PATH`. They run their cores in scratch sessions with
scratch state directories, so they never see your terminals.

Layout:

- `src/hc/`: the hc protocol client (`connection.ts`) and the merged view of all machines (`fleet.ts`). No React Native imports, so the tests run in Node.
- `modules/hc-ssh/`: the native SSH module (Kotlin, JSch + BouncyCastle, on Android; Swift, SwiftNIO SSH, on iOS).
- `plugins/with-ios-scene.js`: adopts the UIScene life cycle, which iOS 27 requires and Expo's template lacks.
- `src/terminal/`: xterm.js in a WebView, fed by hc's attach stream.
- `app/`: screens (Expo Router).

## Run on the Pixel 7 (dev client + Metro)

A Pixel 7 is plugged into `mini` over USB. `adb devices` lists it; wake it with
`adb shell input keyevent KEYCODE_WAKEUP`. `adb`, `scrcpy` and `maestro` come
from `juanibiapina/dotfiles`.

> **The Pixel only runs the development client.** It loads JavaScript from
> Metro on `mini`, so TypeScript changes reach it without a build. A preview
> APK has its JavaScript baked in and ignores Metro, which looks exactly like
> "stuck on old code". Never install one on the Pixel; test release builds on
> another phone.

Point the phone at `mini`, start Metro, and open the app on it:

```sh
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:2222 tcp:22     # SSH: the app's machine "mini" is juan@127.0.0.1:2222
gob add env EXPO_UNSTABLE_HEADLESS=1 pnpm exec expo start
adb shell am start -a android.intent.action.VIEW \
  -d "herdrmobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
  dev.juanibiapina.herdrmobile
```

The tunnels end when the phone is unplugged or the adb server restarts; run
both `adb reverse` lines again. The SSH tunnel uses 2222 because the phone's
`adbd` is unprivileged and cannot listen on port 22. The phone's key is in
`~/.ssh/authorized_keys` as `herdr-mobile@Pixel-7`; reinstalling the app makes
a new one.

Drive the phone with Maestro, which finds elements by their text, and take a
screenshot to show a change:

```sh
maestro --no-ansi hierarchy --compact     # what is on screen
maestro studio                            # inspect and author taps
adb exec-out screencap -p > shot.png
```

Only a native change needs a new dev client (see Release for what counts as
native). Build it locally and install it over the old one:

```sh
export NIXPKGS_ACCEPT_ANDROID_SDK_LICENSE=1
nix develop ~/workspace/juanibiapina/dotfiles#android --command bash -c \
  'pnpm exec eas build --platform android --profile development-pixel --local \
     --non-interactive --output /tmp/herdr-devclient.apk'
adb install -r /tmp/herdr-devclient.apk
```

## Release

There are two paths. Pick by what changed.

**Code change (TypeScript, UI, assets): push to `main`.** CI
(`.github/workflows/ci.yml`) runs typecheck and tests, then publishes an
update to the EAS `preview` channel, which the APK is built to follow. A push
that changes only Markdown publishes nothing. Installed apps download the
update on their next launch, or when they come back to the foreground, and
offer "Restart" on the Agents screen. CI needs the `EXPO_TOKEN` repository
secret. When CI is down, publish by hand:

```sh
pnpm run publish:update --message "what changed"
```

A push with a native change publishes under its new fingerprint, which only
an APK built from that code loads.

**Native change: build a new APK.** Native means the Kotlin module in
`modules/`, a native dependency, or `app.json`. The runtime version is a
fingerprint of the native inputs, so an update can never load on an APK built
from different native code. `npx expo-updates runtimeversion:resolve
--platform android` prints the current fingerprint; when it differs from the
installed APK's (Settings shows which code is running), build a new APK.

Build it locally on `mini` in the Android dev shell from
`juanibiapina/dotfiles`. Cloud builds (`eas build` without `--local`) use the
free plan's 15 monthly Android builds; run one only when asked.

```sh
export NIXPKGS_ACCEPT_ANDROID_SDK_LICENSE=1
nix develop ~/workspace/juanibiapina/dotfiles#android --command bash -c \
  'pnpm exec eas build --platform android --profile preview --local \
     --non-interactive --output /tmp/herdr-mobile-v0.2.0-preview.apk'
```

Every build, local or cloud, is signed with the EAS keystore, so a new APK
installs over any earlier one. Builds signed with the debug key (before
November 2026) must be uninstalled first.

Publish it to the `Herdr Mobile releases` Drive folder, which keeps exactly one
APK. Upload and share the new one before deleting the old one:

```sh
FOLDER=1kpy8XqZVcy9r0JOvXgYKt9bZ-QDF7wDf
gog drive upload /tmp/herdr-mobile-v0.2.0-preview.apk --parent "$FOLDER"
gog drive share <newFileId> --to anyone --force
gog drive ls --parent "$FOLDER"
gog drive delete <oldFileId> --force
```

### iOS

For installing on your own iPhone (no App Store):

```sh
npx expo prebuild --platform ios
npx expo run:ios --device --configuration Release
```

The first run asks Xcode to sign: open `ios/Herdr.xcworkspace`, pick your team under
Signing & Capabilities, and trust the developer profile on the phone
(Settings → General → VPN & Device Management). A free personal team's install
expires after 7 days; run it again to renew.

iOS suspends the app's connections when it is in the background, so there is no
background watching: machines reconnect when you reopen the app.

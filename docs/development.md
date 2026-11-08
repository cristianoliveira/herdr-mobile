# Development

## Set up and check

On an Apple Silicon Mac or x86-64 Linux, enter the repo's Android shell:

```sh
nix develop
adb devices -l
```

The shell provides Node 22, pnpm, Java 17, ADB, and the Android 36 SDK/NDK.
Entering it accepts the Android SDK license. The first run downloads the toolchain.
Keep at least 20 GB free for the SDKs, Gradle caches, and native build outputs.

### Mirror the phone

Connect the phone by USB, enable USB debugging, and accept its authorization
prompt. Run these commands from the repository root:

```sh
# List connected phones.
nix develop --command adb devices -l

# Mirror the only USB-connected phone.
nix develop --command scrcpy --select-usb --window-title "Herdr phone"

# Keep the mirror visible beside your editor, without forwarding phone audio.
nix develop --command scrcpy --select-usb --always-on-top --no-audio --window-height 900 --window-title "Herdr phone"

# Select this Samsung explicitly when multiple phones are connected.
nix develop --command scrcpy --serial RFCR81M1TVN --window-title "Herdr phone"
```

Replace the serial with the value from `adb devices -l` for another phone.
Click and type in the mirror to control the phone; close its window to stop
mirroring. Window resizing scales the full screen without cropping it.

Mirroring does not enable live code updates; those require a development
client and Metro.

```sh
pnpm install          # also builds the terminal page (xterm.js inlined)
pnpm test             # protocol and multi-machine tests against real scratch hc cores
pnpm typecheck
```

The tests need `hc` on `PATH`. They run their cores in scratch sessions with
scratch state directories, so they never see your terminals.

## Install from Just

Run `just devices` to get a phone serial. These targets use the Nix Android
shell and keep app data with `adb install -r`:

```sh
just install path/to/app.apk SERIAL  # existing APK; refuses Pixel 7
just install-dev SERIAL             # local Gradle ARM64 development client
just install-preview SERIAL         # local Gradle standalone test build; not Pixel 7
just install-latest                 # ANDROID_SERIAL, or the only authorized phone
```

Build targets use Expo prebuild and local Gradle in the Nix Android shell.
No Expo login or cloud service is needed. Outputs remain under
`android/app/build/outputs/apk/`. These builds use the local debug signing
key, including standalone test builds; they cannot replace an EAS-signed app.
A failed build never proceeds to installation. A signature mismatch stops
installation; no target uninstalls the app or clears its data. Use an APK
signed with the installed app's key.

`install-latest` chooses `development-pixel` for Pixel 7 phones and `preview`
for other phones. Override that choice with `HERDR_INSTALL_PROFILE=preview`
or `HERDR_INSTALL_PROFILE=development-pixel`; Pixel 7 still rejects preview.
Development clients need Metro (`just metro`, `just reverse`, `just open-app`).

### Automatic checks and installation

The `.watch.yaml` watcher runs tests, installer safety tests, typecheck, then
`just install-latest` for app/build-input changes. A failed step prevents
installation. Generated native files, caches and agent state are excluded
to prevent rebuild loops.

```sh
# Use the sole authorized connected phone.
fzz --log-file .tmp/funzzy/tests.log

# Or select one explicitly before starting/restarting the watcher.
ANDROID_SERIAL=SERIAL fzz --log-file .tmp/funzzy/tests.log
```

Selection refuses multiple phones, unauthorized devices and automatic
emulator selection. An explicit serial takes priority over auto-selection.
Changing the watcher's environment requires restarting it.

For checks without deployment, use `fzz run tests` and `fzz run typecheck`.
Run installer/watcher safety tests alone with
`python3 test/install-recipes.test.py`; these mock builds and device commands.

## Layout

- `src/hc/`: the hc protocol client (`connection.ts`) and the merged view of all machines (`fleet.ts`). No React Native imports, so the tests run in Node.
- `modules/hc-ssh/`: the native SSH module (Kotlin, JSch + BouncyCastle, on Android; Swift, SwiftNIO SSH, on iOS).
- `plugins/with-ios-scene.js`: adopts the UIScene life cycle, which iOS 27 requires and Expo's template lacks.
- `src/terminal/`: xterm.js in a WebView, fed by hc's attach stream.
- `app/`: screens (Expo Router).

## Project discovery

In the app, open **Settings → Projects**. Add as many search paths as you
need. Use the `+ ~/workspace`, `+ ~/other`, or `+ ~/work` shortcuts, or enter
an absolute or `~/` path and tap **Add custom path**. Each saved path has a
**Remove** button. Adding a path does not replace the others.

The picker searches every configured path on each connected machine and
combines results, without duplicate folders on the same machine. `~` expands
to that machine's SSH user's home, not the phone's. A missing path shows an
error but does not hide results from the other paths.

Choose **Direct folders** for `<path>/<repo>`, or **Owner / repo** for
`<path>/<owner>/<repo>`; this layout applies to all search paths. Paths and
layout persist across app restarts. The default remains `~/workspace` with
owner/repo grouping. Directories are not created automatically.

## JavaScript and native changes

A change is native when it touches `modules/`, `plugins/`, `app.json`, or a
native dependency. Everything else (TypeScript, UI, assets) is a JavaScript
change.

A JavaScript change reaches a development client through Metro and reaches
installed apps as an over-the-air update. A native change needs a new
development client and a new APK. See [releasing.md](releasing.md).

To run the app on the shared Pixel, see [pixel-7.md](pixel-7.md).

For another Android phone, enable USB debugging, connect it, and accept the
ADB authorization prompt. To build a standalone APK locally without an Expo
login, run inside `nix develop`:

```sh
pnpm install --frozen-lockfile
pnpm exec expo prebuild --platform android --no-install
(cd android && ./gradlew --no-daemon :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2 -x lintVitalAnalyzeRelease)
adb -s <device-serial> install -r android/app/build/outputs/apk/release/app-release.apk
adb -s <device-serial> shell monkey -p dev.juanibiapina.herdrmobile 1
```

This targets ARM64 phones and bundles JavaScript, so Metro is not needed.
Expo's generated release configuration uses a debug signing key. This is a
local test build, not an official release; it cannot replace an EAS-signed
installation. Do not uninstall an existing app to bypass a signature error:
uninstalling deletes its data. Use the EAS build path in [releasing.md](releasing.md)
for official signing and distribution. Never install this standalone APK on
the shared Pixel 7.

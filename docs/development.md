# Development

## Set up and check

On an Apple Silicon Mac or x86-64 Linux, enter the repo's Android shell:

```sh
nix develop
adb devices -l
```

The shell provides Node 22, pnpm, Java 17, ADB, and the Android 36 SDK/NDK.
Entering it accepts the Android SDK license. The first run downloads the toolchain.

```sh
pnpm install          # also builds the terminal page (xterm.js inlined)
pnpm test             # protocol and multi-machine tests against real scratch hc cores
pnpm typecheck
```

The tests need `hc` on `PATH`. They run their cores in scratch sessions with
scratch state directories, so they never see your terminals.

## Layout

- `src/hc/`: the hc protocol client (`connection.ts`) and the merged view of all machines (`fleet.ts`). No React Native imports, so the tests run in Node.
- `modules/hc-ssh/`: the native SSH module (Kotlin, JSch + BouncyCastle, on Android; Swift, SwiftNIO SSH, on iOS).
- `plugins/with-ios-scene.js`: adopts the UIScene life cycle, which iOS 27 requires and Expo's template lacks.
- `src/terminal/`: xterm.js in a WebView, fed by hc's attach stream.
- `app/`: screens (Expo Router).

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
(cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2 -x lintVitalAnalyzeRelease)
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

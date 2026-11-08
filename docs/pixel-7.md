# Run on the Pixel 7 (dev client + Metro)

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

Only a native change needs a new dev client (see
[development.md](development.md#javascript-and-native-changes)). Build it
locally and install it over the old one:

```sh
just install-dev SERIAL  # replace SERIAL with the Pixel's adb serial
```

This uses Expo prebuild and Gradle in the repository's Nix Android shell.
No Expo login is required. To build and install directly:

```sh
nix develop --command bash -c '
  pnpm exec expo prebuild --platform android --no-install &&
  (cd android && ./gradlew --no-daemon :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --max-workers=2) &&
  adb -s SERIAL install -r android/app/build/outputs/apk/debug/app-debug.apk
'
```

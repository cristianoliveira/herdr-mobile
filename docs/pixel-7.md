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

The app syncs its definition from `~/.config/herdr-mobile` on `mini`, the same
home your own phone uses. Try mods and layouts there under new names, and
remove them afterwards; editing a shipped file moves it aside to
`<name>-edited` on the next connect.

Drive the phone with Maestro, which finds elements by their text, and take a
screenshot to show a change. `adb shell input text` sends key presses, and two
`r`s close together reload the development client (React Native's double R),
so type text with `r`s one key at a time:

```sh
maestro --no-ansi hierarchy --compact     # what is on screen
maestro studio                            # inspect and author taps
adb exec-out screencap -p > shot.png
```

Only a native change needs a new dev client (see
[development.md](development.md#javascript-and-native-changes)). Build it
locally and install it over the old one:

```sh
export NIXPKGS_ACCEPT_ANDROID_SDK_LICENSE=1
nix develop ~/workspace/juanibiapina/dotfiles#android --command bash -c \
  'pnpm exec eas build --platform android --profile development-pixel --local \
     --non-interactive --output /tmp/herdr-devclient.apk'
adb install -r /tmp/herdr-devclient.apk
```

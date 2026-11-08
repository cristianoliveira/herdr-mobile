# Local Android development shortcuts. This file is git-ignored.

_default:
    @just --list

# List connected Android devices.
devices:
    nix develop --command adb devices -l

# Mirror the only USB-connected phone.
scrcpy:
    nix develop --command scrcpy --select-usb --always-on-top --no-audio --window-height 900 --window-title "Herdr phone"

# Start Expo's development server.
metro:
    pnpm start

# Forward Metro and SSH ports to the connected phone.
reverse:
    nix develop --command adb reverse tcp:8081 tcp:8081
    nix develop --command adb reverse tcp:2222 tcp:22

# Open the installed Herdr development client against local Metro.
open-app:
    nix develop --command adb shell am start -a android.intent.action.VIEW \
      -d "herdrmobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
      dev.juanibiapina.herdrmobile

# Run the test suite (requires hc on PATH).
test:
    pnpm test

# Type-check the app.
typecheck:
    pnpm typecheck

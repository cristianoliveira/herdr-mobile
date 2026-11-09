#!/usr/bin/env bash
# This is Expo's PUBLIC test identity, not a production signing credential.
set -euo pipefail

key="$PWD/android/app/debug.keystore"
if [[ ! -f "$key" ]]; then
  echo "Missing Expo test keystore. Run HERDR_VARIANT=alpha pnpm exec expo prebuild --platform android --no-install." >&2
  exit 1
fi

# Fail closed if a future template changes keys: existing alpha data must remain upgradeable.
expected=221e0a3106aa4c3ccc154e0a418b55020b3f9ea6e84f92e8749cd9e2f39f5e58
actual=$(shasum -a 256 "$key")
if [[ "${actual%% *}" != "$expected" ]]; then
  echo "Expo test keystore changed. Restore the original pinned test key before releasing; do not uninstall to bypass a signing mismatch." >&2
  exit 1
fi

export ANDROID_KEYSTORE_FILE="$key"
export ANDROID_KEYSTORE_PASSWORD=android
export ANDROID_KEY_ALIAS=androiddebugkey
export ANDROID_KEY_PASSWORD=android

scripts=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
bash "$scripts/sign-release-apk.sh" "$@"

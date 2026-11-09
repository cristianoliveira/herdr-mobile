#!/usr/bin/env bash
# Sign and verify using the supplied key. The alpha wrapper supplies Expo's public test key.
set -euo pipefail

if [[ $# != 2 ]]; then
  echo "Usage: bash scripts/sign-release-apk.sh INPUT.apk OUTPUT.apk (see docs/releasing.md for signing variables)." >&2
  exit 2
fi

for name in ANDROID_HOME ANDROID_KEYSTORE_FILE ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing %s. For test builds use bash scripts/sign-alpha-apk.sh INPUT.apk OUTPUT.apk; see docs/releasing.md.\n' "$name" >&2
    exit 1
  fi
done

input=$1
output=$2
tools="$ANDROID_HOME/build-tools/36.0.0"
if [[ ! -f "$input" || ! -f "$ANDROID_KEYSTORE_FILE" ]]; then
  echo "Input APK or signing keystore does not exist. Check the build and ANDROID_KEYSTORE_FILE." >&2
  exit 1
fi
if [[ -e "$output" ]]; then
  echo "Output already exists. Choose a new output path; signed releases are not overwritten." >&2
  exit 1
fi
for tool in zipalign apksigner; do
  if [[ ! -x "$tools/$tool" ]]; then
    echo "Missing Android build-tools 36.0.0. Install with sdkmanager 'build-tools;36.0.0'." >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$output")"
work=$(mktemp -d)
success=false
cleanup() {
  rm -rf "$work"
  if [[ "$success" != true ]]; then rm -f "$output" "$output.idsig"; fi
}
trap cleanup EXIT

# apksigner replaces the template's debug signature with the release key.
"$tools/zipalign" -P 16 -f 4 "$input" "$work/aligned.apk"
"$tools/apksigner" sign --ks "$ANDROID_KEYSTORE_FILE" --ks-key-alias "$ANDROID_KEY_ALIAS" \
  --ks-pass env:ANDROID_KEYSTORE_PASSWORD --key-pass env:ANDROID_KEY_PASSWORD \
  --out "$output" "$work/aligned.apk"
"$tools/apksigner" verify --verbose --print-certs "$output"
success=true

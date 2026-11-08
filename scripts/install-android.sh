#!/usr/bin/env bash
set -euo pipefail

mode=${1:-}
serial=${2:-${ANDROID_SERIAL:-}}
apk=${3:-}

case "$mode" in
  apk|auto|development-pixel|preview) ;;
  *)
    echo "Use just install APK SERIAL, just install-dev [SERIAL], just install-preview [SERIAL], or just install-latest [SERIAL]." >&2
    exit 2
    ;;
esac

if [[ "$mode" == apk && ! -f "$apk" ]]; then
  printf 'APK not found: %s. Use just install APK SERIAL.\n' "$apk" >&2
  exit 1
fi

if [[ -z "$serial" ]]; then
  devices=$(adb devices)
  phones=()
  while read -r candidate state rest; do
    if [[ "$state" == device && "$candidate" != emulator-* ]]; then
      phones+=("$candidate")
    fi
  done <<< "$devices"
  if [[ ${#phones[@]} != 1 ]]; then
    echo "Connect exactly one authorized phone, or select one with ANDROID_SERIAL (see just devices)." >&2
    exit 1
  fi
  serial=${phones[0]}
fi

model=$(adb -s "$serial" shell getprop ro.product.model)
model=$(printf '%s' "$model" | tr -d '\r\n')
if [[ -z "$model" ]]; then
  echo "Cannot identify the selected phone. Check authorization with just devices." >&2
  exit 1
fi

if [[ "$mode" == auto ]]; then
  mode=${HERDR_INSTALL_PROFILE:-}
  if [[ -z "$mode" ]]; then
    if [[ "$model" == "Pixel 7"* ]]; then mode=development-pixel; else mode=preview; fi
  fi
  case "$mode" in
    development-pixel|preview) ;;
    *) echo "HERDR_INSTALL_PROFILE must be development-pixel or preview." >&2; exit 2 ;;
  esac
fi

if [[ "$model" == "Pixel 7"* && "$mode" != development-pixel ]]; then
  printf 'Pixel 7 is development-only. Use just install-dev %q.\n' "$serial" >&2
  exit 1
fi

if [[ "$mode" != apk ]]; then
  output=$(mktemp -d "${TMPDIR:-/tmp}/herdr-mobile-${mode}.XXXXXX")
  apk="$output/app.apk"
  printf 'Building %s locally for %s (%s).\n' "$mode" "$model" "$serial"
  pnpm exec eas build --platform android --profile "$mode" --local --non-interactive --output "$apk"
fi

printf 'Installing %s on %s (%s), keeping app data.\n' "$apk" "$model" "$serial"
adb -s "$serial" install -r "$apk"

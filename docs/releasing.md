# Releasing

## Installable alpha APKs: GitHub Releases

Use `v0.2.0-alpha.1` for the first alpha, then `v0.2.0-alpha.2`, and so on.
The version before `-alpha.N` must match `expo.version` in `app.json`.
These are GitHub **prereleases**, not production releases or Play Store uploads.

`.github/workflows/release-android.yml` runs on alpha tags or a manual dispatch
for an existing alpha tag. It:

1. Validates the tag and required signing secrets.
2. Runs typecheck and tests, including real scratch hc cores.
3. Builds an ARM64 release APK using Expo prebuild and Gradle on GitHub's runner.
4. Aligns, signs with a persistent key, and verifies the APK.
5. Uploads the APK and `SHA256SUMS` as workflow artifacts for 14 days.
6. Creates a draft GitHub prerelease, uploads both files, then publishes it.

The app includes its JavaScript and works **without Metro or Expo Go**.
No EAS login, EAS build quota, or external build service is needed for this
workflow. The existing preview OTA configuration remains active: a later push
to `main` can update compatible installed alpha apps.

### One-time signing setup

Authenticate GitHub CLI with access to `cristianoliveira/herdr-mobile`:

```sh
gh auth login
gh auth setup-git
```

Configure these **repository Actions secrets** under Settings → Secrets and
variables → Actions, or use the commands below:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded persistent JKS/PKCS12 signing keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Signing key alias |
| `ANDROID_KEY_PASSWORD` | Signing key password |

**Use the same keystore as the installed standalone app.** Existing EAS-signed
apps need their original EAS keystore, not a newly generated key. The owner can
export it once through `pnpm exec eas credentials --platform android`; the
GitHub build itself does not use EAS. Keep an encrypted backup of the key and
passwords outside this repository. Never commit them or paste them into chat.

For a fresh installation lineage only, generate a key outside the repository.
`keytool` prompts for passwords; do not put passwords in command arguments:

```sh
mkdir -p "$HOME/.config/herdr-signing"
chmod 700 "$HOME/.config/herdr-signing"
keytool -genkeypair -storetype PKCS12 \
  -keystore "$HOME/.config/herdr-signing/release.p12" \
  -alias herdr-release -keyalg RSA -keysize 3072 -validity 10000
chmod 600 "$HOME/.config/herdr-signing/release.p12"
```

For PKCS12, use the store password as the key password. Substitute the actual
keystore path below. `gh secret set` prompts for the remaining values:

```sh
base64 < "$HOME/.config/herdr-signing/release.p12" | \
  gh secret set ANDROID_KEYSTORE_BASE64 --repo cristianoliveira/herdr-mobile
gh secret set ANDROID_KEYSTORE_PASSWORD --repo cristianoliveira/herdr-mobile
gh secret set ANDROID_KEY_ALIAS --repo cristianoliveira/herdr-mobile
gh secret set ANDROID_KEY_PASSWORD --repo cristianoliveira/herdr-mobile
```

Missing secrets stop the workflow before the native build. Signing credentials
are exposed only to the signing step; passwords are passed to `apksigner`
through environment variables and the temporary keystore is removed on exit.
The final APK is never published with the Expo template's debug signature.

### Publish an alpha

Commit finished work, then create and push a new tag. Pushing only the tag does
not push `main` or trigger its preview OTA update job:

```sh
git tag -a v0.2.0-alpha.1 -m 'Herdr 0.2.0 alpha 1'
git push origin refs/tags/v0.2.0-alpha.1
gh run list --workflow release-android.yml --repo cristianoliveira/herdr-mobile
gh release view v0.2.0-alpha.1 --repo cristianoliveira/herdr-mobile
```

Download `herdr-mobile-v0.2.0-alpha.1-arm64.apk` from the release's Assets section
on your phone. Allow installation from that browser if Android requests it.

APK version names include the alpha suffix. Version codes are `100000 +` the
release workflow's run number, increasing for each new run and stable on
reruns. The Gradle init script changes packaged version metadata, not app.json
or its OTA fingerprint. If an existing installation has a higher version code,
stop and choose a higher base before publishing; do not uninstall or use a
forced downgrade to bypass it. Preserve this workflow's run history when
iterating so version codes do not reset.

To retry an unpublished tag once the workflow exists on the default branch:

```sh
gh workflow run release-android.yml -f tag=v0.2.0-alpha.1 \
  --repo cristianoliveira/herdr-mobile
```

You can also rerun its failed Actions run. Published releases are not overwritten.
If publication failed after creating a draft, inspect it; delete **only that
unpublished draft** before retrying, keeping its tag. For an already published
alpha, create the next alpha tag instead of moving a tag or replacing its APK.

### Installation safety

- Use a personal ARM64 test phone. The USB Pixel 7 on `mini` stays development-only;
  never install a standalone release APK there. See [pixel-7.md](pixel-7.md).
- New APKs must use the same package name and signing key to upgrade in place.
  A signature mismatch is a stop condition: recover the original key. Never
  uninstall the app to bypass it; that loses saved machines, keys, and snippets.
- Verify `SHA256SUMS` when downloading with a computer. To install through USB on
  a supported non-Pixel test phone, use `just install path/to/app.apk SERIAL`,
  which preserves app data.

## JavaScript updates: push to main

The existing CI workflow (`.github/workflows/ci.yml`) runs typecheck and tests,
then publishes an Android update to the EAS `preview` channel. Markdown-only
pushes publish nothing. This separate OTA path still needs `EXPO_TOKEN`.
When CI is down, publish by hand:

```sh
pnpm run publish:update --message "what changed"
```

A push with a native change publishes under its new fingerprint, which only
an APK built from matching native code loads. Settings shows the running code.
The initial alpha APK can be built and released without `EXPO_TOKEN`.

## Local development

Local builds and phone installation continue to use direct Expo prebuild and
Gradle in the repository's Nix Android shell. They do not require an Expo login.
See [development.md](development.md) and [pixel-7.md](pixel-7.md). EAS cloud builds
remain opt-in, only when explicitly requested.

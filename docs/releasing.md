# Releasing

## Quick alpha release: click, download, install

No signing secrets, Expo account, or EAS build service are required.

1. Merge finished work into `main`.
2. Open **GitHub → Actions → Android alpha release → Run workflow**.
3. Select **main**, then click **Run workflow**. No tag or other input is needed.
4. Wait for the build and publication jobs to succeed.
5. On your personal phone, open **GitHub → Releases**, open the newest alpha,
   and download `herdr-alpha-v0.2.0-alpha.N-arm64.apk` from **Assets**.
6. Open the APK and allow installation from your browser if Android asks.

The workflow selects the next alpha number for `expo.version` in `app.json`:
`v0.2.0-alpha.1`, `v0.2.0-alpha.2`, and so on. It creates the tag at the exact
built commit, then publishes a GitHub **prerelease**, not a Play Store release.
For the next update, repeat the same steps and install the new APK over the old
alpha. ARM64 is supported; no Metro, Expo Go, or computer connection is needed.

You can also dispatch from CLI after authenticating:

```sh
gh workflow run release-android.yml --ref main --repo cristianoliveira/herdr-mobile
```

### Separate test app

- App name: **Herdr Alpha**.
- Android package: `dev.juanibiapina.herdrmobile.alpha`.
- URL scheme: `herdrmobile-alpha`.
- Installs alongside regular Herdr and has its own machines, SSH keys, and snippets.
  Set up machine connections once in the alpha app; existing Herdr data is untouched.
- Runs the code bundled in its APK. Preview OTA updates are disabled for Alpha;
  installing the next APK is its only update path.
- The USB Pixel 7 on `mini` remains development-only. Never install this APK there.
  Use a personal test phone. See [pixel-7.md](pixel-7.md).

`app.config.js` enables this identity only with `HERDR_VARIANT=alpha`, which the
release workflow sets. Default local development and preview builds keep their
existing identity and OTA behavior. Unknown variant values fail rather than
silently building the wrong app.

### Automatic public test signing

Android cannot install an unsigned APK. Instead, alpha releases use Expo's
existing **public test keystore**, with the standard public test credentials.
There is no private signing secret for you to obtain or configure. The workflow
reuses the same key on every build, not a newly generated key or an expiring cache.

`scripts/sign-alpha-apk.sh` checks the template keystore's pinned SHA-256 hash
before signing. If a future Expo template changes keys, the build stops rather
than silently producing an incompatible update. Restore the original public
test key from the previously pinned Expo template before releasing again; do
not uninstall to bypass a signature mismatch. APKs are aligned and their
signatures verified before uploading.

**Testing only:** this public key does not prove the publisher's identity.
Anyone with the same public test keystore can sign a replacement alpha APK.
Install only APKs downloaded from this repository's Releases page. Do not use
this signing arrangement for production distribution or sensitive accounts.
A production app will need a private signing key and a different package name.
No private keystore or password is committed to this repository.

### What CI does

`.github/workflows/release-android.yml`:

1. Checks out the selected ref and resolves the alpha tag.
2. Runs typecheck and tests, including real scratch hc cores.
3. Uses Expo prebuild and Gradle on GitHub's runner to build a standalone APK.
4. Pins the public test key, aligns, signs, and verifies the APK.
5. Stores the APK and `SHA256SUMS` as workflow artifacts for 14 days.
6. Verifies checksums in a separate publication job, uploads files to a draft
   prerelease, then publishes it. Only this job has repository write permission.

Packaged version names include the alpha suffix. Version codes are `100000 +`
the workflow run number, increasing on new runs and stable on reruns. Preserve
this workflow's run history so codes do not reset. Alpha tag planning is serialized
to prevent two manual releases choosing the same next number.

An explicit tag push such as `git push origin v0.2.0-alpha.1` still works. Its
version must match app.json, and the workflow builds that tag's commit. Tags
created by the publication job use GitHub's built-in token, which does not
recursively trigger another workflow run.

Published releases and APKs are not overwritten. If publication failed after
creating a draft, inspect it and remove only that unpublished draft before
retrying, keeping its tag. If a published alpha has a problem, create the next
alpha instead of moving its tag. Missing or changed signing keys, invalid tags,
failed tests/builds, and failed APK verification all stop publication.

For a USB install on a supported personal phone:

```sh
just install path/to/herdr-alpha.apk SERIAL
```

This preserves alpha app data. Never uninstall to bypass a signing mismatch.

## Existing preview updates: push to main

The existing CI workflow (`.github/workflows/ci.yml`) still runs typecheck and
tests, then publishes an Android update to the EAS `preview` channel when app
files change and `EXPO_TOKEN` is configured. Without the token, CI reports that
the optional preview publish was skipped; typecheck and tests still run and
remain required. Markdown-only pushes publish nothing. This separate OTA path
uses `EXPO_TOKEN`, but the alpha APK workflow does not. Merging to main can
therefore update existing preview apps; it does not automatically create an
alpha APK.

Alpha builds have OTA disabled and will not receive these updates. Regular
preview builds keep the original package and update behavior. When needed,
preview updates can still be published by hand:

```sh
pnpm run publish:update --message "what changed"
```

## Local development

Local builds and phone installation continue to use direct Expo prebuild and
Gradle in the repository's Nix Android shell. They do not require an Expo login.
See [development.md](development.md) and [pixel-7.md](pixel-7.md). EAS cloud builds
remain opt-in, only when explicitly requested.

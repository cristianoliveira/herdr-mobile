# Development

## Set up and check

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

To run the app on a phone, see [pixel-7.md](pixel-7.md).

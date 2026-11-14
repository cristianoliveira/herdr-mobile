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

- `src/hc/`: the hc protocol client (`connection.ts`), the merged view of all machines (`fleet.ts`), and each machine's `herdr-app` document, which desktop shares (`herdr-doc.ts`). No React Native imports, so the tests run in Node.
- `modules/mod-engine/`: the native mod engine: QuickJS-ng (`cpp/quickjs/`, its amalgamated release) behind a small C layer (`cpp/mod_engine.c`), on one thread of its own. Android only so far. The tests build the C layer with `cc` and run it through `cpp/me_cli.c`.
- `src/mods/`: running mods. `runtime/` is the JavaScript each engine loads (`herdr-ui`, `herdr`); `copy.ts` runs one mod copy; `engine-wasm.ts` is the same QuickJS-ng release built to WebAssembly, for tests and `check.mjs`; `data.ts` and `../commands.ts` are what mods read and do.
- `src/definition/`: the definition: `defaults/` is the shipped home (layouts, mods, icons, the agents' guide and `.d.ts` files); `sync.ts` keeps the phone's copy in step with the definition machine; `store.ts` keeps last good versions and `.error` files; `controller.ts` wires them into the app.
- `src/check/`: `check.mjs`, which agents run in the definition home.
- `scripts/build-mod-files.mjs` embeds the runtime and the shipped home (with `check.mjs`, bundled by esbuild) as generated TypeScript. It runs on install and before tests and typecheck; run it after editing `src/mods/runtime/` or `src/definition/defaults/` while Metro runs.
- `modules/hc-ssh/`: the native SSH module (Kotlin, JSch + BouncyCastle, on Android; Swift, SwiftNIO SSH, on iOS).
- `plugins/with-ios-scene.js`: adopts the UIScene life cycle, which iOS 27 requires and Expo's template lacks.
- `src/terminal/`: xterm.js in a WebView, fed by hc's attach stream.
- `app/`: screens (Expo Router).

## JavaScript and native changes

A change is native when it touches `modules/`, `plugins/`, `app.json`, or a
native dependency.

QuickJS-ng is pinned to the release `@jitl/quickjs-ng-wasmfile-release-sync` is
built from (see `modules/mod-engine/cpp/quickjs/VERSION`), so the phone, the
tests and `check.mjs` run the same engine. Bump both together. Everything else (TypeScript, UI, assets) is a JavaScript
change.

A JavaScript change reaches a development client through Metro and reaches
installed apps as an over-the-air update. A native change needs a new
development client and a new APK. See [releasing.md](releasing.md).

To run the app on a phone, see [pixel-7.md](pixel-7.md).

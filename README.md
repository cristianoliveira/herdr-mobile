# Herdr Mobile

A native Android and iOS client for [herdr-core](https://github.com/herdrdev/herdr-core)
(`hc`): watch, start, and talk to the coding agents (Pi, Claude Code, and
others) running on all your machines. It connects to each machine over SSH and
runs `hc connect` there, so it needs no server, relay, or plugin. Tailscale or
any other network that reaches SSH works.

- **Spaces:** your spaces on every machine, with their branch and worktrees,
  the same ones herdr-app desktop shows. Tap one for its tabs.
- **Agents:** every agent by what needs you first, with the sub-agents each
  one started. Swipe right to close one; long press for more.
- **Terminal:** live and in color, at phone or desktop size. Type straight into
  it, or send prose to an agent in message mode.
- **Start things:** a terminal or any installed agent in a space, a new space
  in a folder, or a git worktree.
- **Changes:** a space's git diff, and a commit.

## Change the app with your agents

Every screen above is a mod: a small JavaScript program in
`~/.config/herdr-mobile` on one of your machines, the definition machine
(Settings → Definition). An agent on that machine can change any of them or add
its own, and the phone redraws within a second, like herdr-app desktop does
with `~/.config/herdr-app`. Copy the agent prompt from Settings → Definition
and paste it into an agent; the guide it points to teaches the rest.

If a layout goes wrong, Settings → Definition → Reset layout brings back the
shipped one. Settings, Machines and the terminal are always the app's own.

## Requirements

- herdr-core (`hc`) on each machine you want to reach:

  ```sh
  curl -fsSL https://releases.herdr.dev/core/install.sh | sh
  ```

- An SSH server on each machine that the phone can reach.

## Install

**Android:** there is no public APK download yet. To build one, see
[Build an APK](docs/releasing.md#build-an-apk).

**iOS:** build the app on a Mac with Xcode and install it on your iPhone:

```sh
pnpm install
npx expo prebuild --platform ios
npx expo run:ios --device --configuration Release
```

The first run asks Xcode to sign the app. Open `ios/Herdr.xcworkspace`, pick
your team under Signing & Capabilities, and trust the developer profile on the
phone (Settings → General → VPN & Device Management). A free personal team's
signature expires after 7 days; run the last command again to renew it.

## Connect your machines

The app makes its own SSH key. Copy it from Settings → Machines → Copy, add it
to `~/.ssh/authorized_keys` on each machine, and add the machines in
Settings → Machines. The app pins the first host key each machine presents.
Machines that one of yours added with `hc machine add` show up through it too.

## Updates

On Android the app downloads updates by itself and offers Restart to update
in the ⋯ menu. On iOS, build and install it again.

## Limitations

- On iOS, mods don't run yet, so Spaces and Agents show an error; Settings,
  Machines and terminals work.
- iOS suspends the app's connections in the background; they come back when
  you open it.

## Contributing

See [docs/development.md](docs/development.md).

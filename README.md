
# Herdr Mobile

A native Android and iOS client for [herdr-core](https://github.com/herdrdev/herdr-core)
(`hc`): watch, start, and talk to the coding agents (Pi, Claude Code, and
others) running on all your machines from your phone. It connects to each
machine over SSH and runs `herdr-core connect` there, so it needs no server,
bridge, relay, or plugin on your machines. Tailscale or any other network
that reaches SSH works.

- **Spaces:** your spaces on every machine, grouped by machine, each with its
  color, branch, ahead/behind, and its worktrees under it, the same spaces
  herdr-app desktop shows. Tap one to see its tabs; long press for its menu
  (rename, move, worktrees, Changes, close).
- **Agents:** every agent, by what needs you (Needs you, Done, Working, Idle)
  or grouped by space, with the sub-agents each one started. The tab's badge
  counts the ones that need you. Tap one to open it, swipe it right to close
  it, long press to pin, interrupt, copy its output or kill it.
- **Search:** the magnifying glass at the top of Spaces finds any agent or
  space by name, message or machine.
- **Terminal:** live, in color, with the images agents draw, at phone size or
  your desktop's size (switch in the ⋯ menu). Swipe up or down to scroll its history, or a full-screen program. Tap
  it and type: keys go straight to the terminal, and the keyboard suggests and
  corrects words as in any app. The key bar
  sends esc, tab, arrows, ctrl combinations and the clipboard instantly.
  Message mode is for prose to agents: Enter sends it, and hc pastes it and
  presses Enter.
- **Start things:** + starts a terminal or any installed agent (Pi, Claude
  Code, Codex, ...) as a new tab in a space, a new space in a folder on a
  machine, or a git worktree as its own space. Spaces and tabs you make or
  rename on the phone show up in herdr-app desktop, and the reverse.
- **Changes:** a space's git changes with their diffs, and a commit.

## Change the app with your agents

The app draws itself from a **definition**: layouts and mods (small
JavaScript programs) in `~/.config/herdr-mobile` on one of your machines, the
*definition machine* (Settings → Definition; the first machine unless you
pick another). Every screen above is a shipped mod. An agent on that machine
can change any of it, or add screens of its own, and the phone redraws
within a second while it's open. It works like herdr-app desktop's
`~/.config/herdr-app`.

To start, copy the agent prompt from Settings → Definition (or the ⋯ menu)
and paste it into an agent, or keep it in your dotfiles:

> Read ~/.config/herdr-mobile/AGENTS.md on mini (from another machine: `hc file read --on mini ~/.config/herdr-mobile/AGENTS.md`), then tell me what you can change in Herdr Mobile.

The guide teaches the agent the rest: the files, the mod API, and
`check.mjs`, which checks its work without the phone (it needs Node 18 or
later on the definition machine). A broken file never breaks the screen:
the phone keeps the last good version, shows the error, and writes it to a
`.error` file next to the broken one.

Shipped layouts and mods are the app's: they're replaced when the app
updates, and one you edited is moved aside first (`mods/spaces-edited`).
Copy a shipped mod under a new name to change it. If a layout goes wrong,
Settings → Definition → Reset layout puts the shipped one back. Settings,
Machines and the terminal screen are always the app's own.

## Requirements

- herdr-core (`hc`) on each machine you want to reach:

  ```sh
  curl -fsSL https://releases.herdr.dev/core/install.sh | sh
  ```

- An SSH server on each machine that the phone can reach.

## Install

**Android:** there is no public APK download yet. To build one, see
[Build an APK](docs/releasing.md#build-an-apk).

**iOS:** build the app on a Mac with Xcode and install it on your own iPhone:

```sh
pnpm install
npx expo prebuild --platform ios
npx expo run:ios --device --configuration Release
```

The first run asks Xcode to sign the app. Open `ios/Herdr.xcworkspace`, pick
your team under Signing & Capabilities, and trust the developer profile on the
phone (Settings → General → VPN & Device Management). An install signed with a
free personal team expires after 7 days. Run the last command again to renew
it.

## Connect your machines

The app makes its own Ed25519 SSH key. Copy its public key from
Settings → Machines → Copy and add it to `~/.ssh/authorized_keys` on each
machine. Then add each machine in Settings → Machines. The app trusts the
first host key a machine presents and pins it.

The app connects to every machine you add and merges their lists. A machine
that another machine added with `hc machine add` shows up through that machine
too, as `hc ls` would show it. When the app also reaches that machine
directly, each terminal is listed once and the direct connection is used.

## Updates

On Android, the app downloads updates when it starts or comes back to the
foreground, then offers Restart to update in the ⋯ menu (a dot marks it). Settings shows which
version is running and can check for updates.

On iOS, build and install the app again to update it.

## Limitations

iOS suspends the app's connections while it is in the background. Machines
reconnect when you open the app again.

On iOS, the mod engine isn't built yet, so the screens drawn by mods (Spaces,
Agents, a space's tabs) show an error; Settings, Machines and terminals
work.

## Contributing

See [docs/development.md](docs/development.md).

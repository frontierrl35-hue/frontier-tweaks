# Frontier Tweaks

A Windows desktop optimization utility built with Electron 36, React 19, Vite,
Tailwind CSS 4, React Router 7, and Zustand 5.

## Running it

This project was written in a sandbox with no network access, so it has
**not** been `npm install`-ed, built, or run. Do that on your own Windows
(or macOS/Linux for dev) machine:

```bash
npm install
npm run dev        # starts Vite + Electron in dev mode with hot reload
```

Build a production bundle:

```bash
npm run build
```

Package the Windows installer:

```bash
npm run dist
```

The installer (`Frontier-Tweaks-Setup-1.0.0.exe`) will be written to
`release/`. You'll need to supply your own `build/icon.ico` (referenced in
`electron-builder.yml`) — a placeholder isn't included since I can't generate
binary assets here.

## Auto-updates

The app checks GitHub Releases for new versions on startup (packaged builds
only — skipped entirely in `npm run dev`) via `electron-updater`, and again
whenever someone clicks **Check now** on the Settings page. Downloads are
never automatic: a banner (and the Settings page) offers **Download**, then
**Restart & Install** once it's ready, so a tweak session never gets
interrupted by a surprise restart.

To publish a release everybody's running copy can pick up:

1. In `electron-builder.yml`, set `publish.owner` / `publish.repo` to your
   GitHub repo.
2. Bump `"version"` in `package.json` (and `APP_VERSION` in
   `src/shared/types.ts`, which drives the in-app "Version" label).
3. Set a `GH_TOKEN` env var to a GitHub personal access token with `repo`
   scope.
4. Run `npm run release`. This builds the app, packages the NSIS installer,
   and uploads both it and the `latest.yml` metadata file to a new GitHub
   Release under that tag.

That's the whole update pipeline — electron-builder auto-generates the small
`app-update.yml` electron-updater reads at runtime from the `publish:` block
above; there's no update-config file to hand-write.

**Note:** the app isn't code-signed. Unsigned installers trigger a Windows
SmartScreen warning on first run ("Windows protected your PC" → More info →
Run anyway) — that's expected without a code-signing certificate, and it
doesn't affect whether auto-updates work once installed.

**Note:** most of the actual tweak logic (registry edits, `powercfg`,
`netsh`, etc.) shells out to `powershell.exe`, so `npm run dev` will only
fully exercise those code paths on a real Windows machine. On macOS/Linux the
UI runs fine but PowerShell calls will fail gracefully (tweaks show
"Unknown" status, `apply()` returns a structured failure — the app won't
crash, per the error-handling requirements).

## Architecture

```
React Renderer  →  preload.ts (contextBridge)  →  IPC  →  Electron Main  →  PowerShell/Registry
```

- **Renderer** (`src/renderer/`) never touches Node or the filesystem
  directly. It only calls `window.frontier.*`, a typed API surface.
- **Preload** (`src/preload/preload.ts`) exposes exactly five namespaces
  (`window`, `system`, `hardware`, `tweaks`, `backups`) via
  `contextBridge.exposeInMainWorld` — `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`.
- **Main process** owns all privileged work: `src/main/ipc/index.ts` routes
  IPC calls to `src/main/services/*`, which call
  `src/main/utils/exec.ts::runPowerShell()` — the **only** place a process is
  spawned, always via an argument array (never a shell string), always with a
  timeout, always returning a structured `{ success, message, data?, error? }`
  result. Every IPC handler is wrapped in `safeHandle()`, which catches thrown
  errors and turns them into a failure result instead of an unhandled
  rejection.
- **Tweak registry** (`src/main/services/tweakRegistry.ts`) is the single
  source of truth: each tweak declares `detect()` (reads real
  registry/`powercfg` state), `apply()`, and `revert()`. Reversible tweaks
  snapshot the original registry value before changing it
  (`stateStore.ts`) so `revert()` restores the actual prior value, not a
  hardcoded guess.
- **Backups** (`src/main/services/backupManager.ts`) write named JSON
  snapshots to the app's userData folder and, on restore, re-run `revert()`
  for every tweak captured in that snapshot — so restoring changes real
  system state, not just a status label.

## Implemented

- Frameless custom window (custom minimize/maximize/close, drag region)
- Secure IPC architecture end-to-end, typed on both sides
- Sidebar + React Router routing across all 8 pages, lazy-loaded
- Home dashboard with **real** CPU/RAM/OS/uptime info via `os` + CIM queries,
  live optimization score derived from actual applied-tweak count
- Hardware page with real CPU/GPU/RAM/motherboard/storage/BIOS/network
  detection via `Get-CimInstance`, with loading states — no fabricated data
- 8 real tweaks wired end-to-end (apply + detect, 6 of them also revert):
  disable mouse acceleration, disable Game DVR, enable HAGS, high-performance
  power plan, optimize visual effects, flush DNS, reset Winsock, clear temp
  files, empty Recycle Bin
- Apply / Undo per tweak with live status (`applied` / `not-applied` /
  `unknown`) detected from the actual registry/power state on load
- Apply All with a real progress modal: per-step IPC progress events, step
  counter, live success/fail log, final summary — errors never stop the
  batch or crash the app
- Full backup system: create/list/restore/delete, restore replays real
  `revert()` calls
- Global React error boundary + main-process `uncaughtException` /
  `unhandledRejection` guards, so a failed tweak or a render error can never
  take down the app
- Structured JSON-line logging to the app's userData/logs folder with secret
  redaction
- Settings page (toggles are wired to a Zustand store; a couple — like
  actually registering a Windows startup task — are UI-only, see below)
- Design system: dark near-black palette, Poppins, consistent card/radius/
  shadow tokens in `styles/index.css`

## Genuinely unfinished / left as scaffolding

- **Windows and Advanced pages only reuse the shared tweak registry** —
  `windows` has 2 tweaks, `advanced` has 0 (renders an empty state). The
  spec calls for a much larger tweak catalog; the registry
  (`tweakRegistry.ts`) is structured so adding more is just appending
  objects with `apply`/`revert`/`detect`, but I only populated a
  representative, safe first batch rather than dozens per category.
- **"Launch on startup" and "Notifications" toggles** update UI state only —
  they aren't wired to `app.setLoginItemSettings()` or native notifications
  yet.
- **No app icon** (`build/icon.ico`) — electron-builder's Windows target
  needs one supplied before `npm run dist` will produce a fully-branded EXE.
- **No admin-elevation flow** — tweaks marked `requiresAdmin: true` (like
  HAGS) will simply fail with an access-denied message if the app isn't
  already running elevated, rather than prompting a UAC dialog. Adding that
  cleanly (a manifest tweak or a `sudo-prompt`-style relaunch) is the next
  thing I'd build.
- **Developer diagnostics panel** (section 31 of the spec — IPC/tweak/backup
  self-test screen) is not built.
- Never actually run: no `npm install`, `npm run build`, or `npm run dist`
  has been executed against this code, since this sandbox has no network
  access and isn't Windows. Expect to fix a handful of small TypeScript/
  import issues on first real build — I've tried to keep types strict and
  consistent, but I can't guarantee a zero-error `tsc` run without actually
  invoking the compiler.

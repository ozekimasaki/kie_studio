# KIE STUDIO

**English** | [日本語](./README.ja.md) | [中文](./README.zh.md)

A Studio for **IMAGE / VIDEO / AUDIO** generation powered by kie.ai's Market API and dedicated workflows. Runs both in the browser (Vite + React) and as a **single desktop app** packaged with Electrobun (Win/mac/Linux).

> **Disclaimer**: KIE STUDIO is a 100% unofficial fan-made tool. It is not affiliated with, endorsed by, or sponsored by kie.ai. All product names, logos, and brands are property of their respective owners. Use at your own risk.

- Vite + React 19 + Tailwind CSS v4
- Hono API (runs on Bun runtime; API key stays server-side only)
- Electrobun desktop edition (native webview + Bun main process, delta auto-update)
- Model catalog integrating docs OpenAPI and dedicated workflows
- Dynamic forms for reference upload / numeric / checkbox fields
- Unified generation & status management across Market / Suno / Veo / Runway
- History gallery (multi-media, synced lyrics, pin, reuse, retry, JSON import/export)
- Conversation & narration editing with a persistent audio player
- Prompt optimization (Grok CLI) and snippets
- `@reference` insertion & Kling Elements support

> For agent working guidelines see [AGENTS.md](./AGENTS.md); for UI/design policy see [DESIGN.md](./DESIGN.md); for the pre-release checklist see [docs/PRE_RELEASE.md](./docs/PRE_RELEASE.md).

## Requirements

- [Bun](https://bun.sh) (required for `dev:server` and Electrobun builds)
- Node.js (recent LTS that supports Vite 8 / React 19; recommended 20.19+ or 22.12+) and npm
- kie.ai API key (<https://kie.ai/api-key>). The desktop app can also save it from the in-app settings panel.
- Optional: [Grok CLI](https://docs.x.ai/build/overview) for prompt optimization (authenticate via `grok login` or `XAI_API_KEY`)
- Optional: Agent-mode Grok via **X account OAuth** in Settings (SuperGrok / Premium+; no `XAI_API_KEY` required), or via an `XAI_API_KEY`

## Setup

```bash
cp .env.example .env
# Set your key obtained from https://kie.ai/api-key in .env
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://127.0.0.1:8787 (Vite proxies `/api`)

To use prompt optimization, install [Grok CLI](https://docs.x.ai/build/overview) and run `grok login`, or set `XAI_API_KEY` in `.env`.

## Desktop App (Electrobun)

Requires Bun. Loads the built UI in a native webview and starts the Hono API inside the Bun main process.

```bash
npm run desktop:dev            # Development (electrobun run --env=dev)
npm run desktop:build:canary   # Canary build (vite build + electrobun build)
npm run desktop:build:stable   # Stable build
```

- **API Key**: No `.env` needed on first launch. Save from the settings icon (top-right); persisted in SQLite (stored key takes priority over env vars).
- **Data storage**: DB is created in the app's user-data directory (`studio.db` under `Utils.paths.userData`). Dev uses `data/studio.db`.
- **Distribution**:
  - **Windows**: Inno Setup installer `canary-win-x64-KIESTUDIO-Setup.exe` (primary channel). Generated via `npm run desktop:installer:win`. Registered in Add/Remove Programs with icon, version, and publisher; includes uninstaller and Start Menu/Desktop shortcuts. Per-user install (`%LocalAppData%\ai.kie.studio\<channel>\app`), no admin required. User DB (`studio.db`) is never removed on uninstall.
  - **Linux**: tar.gz self-extracting archive (`canary-linux-x64-KIESTUDIO-canary-Setup.tar.gz`) only. Electrobun does not support `.deb` natively.
  - Auto-update artifacts (`tar.zst` + `update.json` + patch) are served from `RELEASE_BASE_URL` as before (independent of Inno Setup).
- **App icon**: `assets/icon-master.svg` (K monogram motif) is converted via `npm run icons` to `icon.ico` (Windows, multi-size) / `icon.png` (Linux, 512px) / `icon.iconset` (macOS, convert to .icns with iconutil) and referenced in `electrobun.config.ts`. On Windows, `scripts/embed-win-icon.mjs` embeds the icon into launcher.exe post-build to avoid Electrobun's rcedit path-resolution bug (also re-embedded during installer build).
- **Supported architectures**:
  - Windows: x64 only. ARM Windows runs the x64 build via OS-level emulation, so no separate build is needed.
  - Linux: x64 distribution only. arm64 is supported by Electrobun but cross-build is unavailable; deferred until an arm64 build environment/CI is secured.
- **Unsigned distribution OS warnings**: No code signing or notarization is performed.
  - macOS: Right-click → "Open" on first launch, or allow via System Settings > Privacy & Security.
  - Windows: SmartScreen → "More info" → "Run anyway".
  - Linux: Grant execute permission.
- **Auto-update**: Set `RELEASE_BASE_URL` to a static host to enable delta updates (bsdiff + zstd) on launch. Silently skipped when unset. Use `canary` for daily testing, `stable` for production.
- Each OS build must run on that OS (no cross-build). CI example: `.github/workflows/release.yml` (tag push triggers 3-OS matrix build, publishes to GitHub Releases).

## Model Catalog Sync

On `npm run dev` startup, the catalog auto-syncs from docs if stale (default: older than 12 hours).

- Skipped if fresh (no full sync on every `tsx watch` restart)
- Force sync: `SYNC_MODELS_FORCE=1 npm run dev` or `npm run sync:models -- --force`
- Disable startup sync: `SYNC_MODELS_ON_START=0`

Manual sync:

```bash
npm run sync:models
npm run sync:models -- --force
```

Regenerates `src/data/catalog.json` from [llms.txt](https://docs.kie.ai/llms.txt) and each model page's OpenAPI spec.

## Key Features

| Feature | Description |
|---------|-------------|
| Dynamic forms | Fields generated from catalog OpenAPI schemas |
| Reference | Image/video/audio upload; single `image_url` also uses file-attach UI |
| `@reference` | Insert reference mentions into prompts (Seedance / Kling, etc.) |
| Unified provider tasks | Normalized generation, polling, and errors across Market / Suno / Veo / Runway |
| AUDIO workflow | Suno songs, extensions, covers, lyrics, narration, conversation, audio processing |
| Audio playback | Persistent mini-player, waveform, synced lyrics, Persona & external audio asset shelf |
| History | SQLite storage; multi-media, parent-child relations, pin, input restore, retry, ZIP/JSON export |
| Prompt optimization | Optimize / generate via Grok CLI with per-model profiles |
| Snippets | One-click insertion of frequently used phrases |
| Batch generation | Submit multiple tasks with the same input |

## Local API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check & API key presence |
| GET | `/api/models?category=image\|video\|audio` | Market catalog + dedicated workflows |
| POST | `/api/upload` | Forwards to File Upload API; audio registered to asset shelf |
| GET | `/api/audio-assets` | List external audio assets |
| DELETE | `/api/audio-assets/:id` | Delete an external audio asset |
| POST | `/api/generate` | Create task via provider / operation adapter |
| GET | `/api/task?provider=&operation=&taskId=` | Normalize per-provider status to common format |
| GET | `/api/credits` | Remaining credits |
| POST | `/api/download-url` | Temporary download URL (20 min) |
| POST | `/api/archive` | Export multi-media + lyrics as ZIP |
| POST | `/api/suno/timestamped-lyrics` | Fetch synced lyrics & waveform data |
| POST | `/api/suno/style` | Assist Suno music style |
| POST | `/api/suno/persona` | Create & save a Persona |
| GET | `/api/personas` | List Persona shelf |
| DELETE | `/api/personas/:id` | Delete a Persona |
| GET | `/api/grok/status` | Grok CLI availability |
| GET | `/api/settings/grok-oauth` | X-account OAuth login status (agent Grok) |
| POST | `/api/settings/grok-oauth/login/start` | Start device-code OAuth |
| POST | `/api/settings/grok-oauth/login/poll` | Poll device-code approval |
| POST | `/api/settings/grok-oauth/logout` | Clear stored OAuth tokens |
| ALL | `/api/grok-oauth/v1/*` | OpenAI-compatible proxy using OAuth bearer |
| GET | `/api/optimize-profile?modelId=` | Per-model optimization profile |
| POST | `/api/optimize-prompt` | Prompt optimization / generation |
| GET | `/api/history` | List history (SQLite) |
| PUT | `/api/history` | Bulk replace history |
| POST | `/api/history/import` | Import history from JSON |
| POST | `/api/history/migrate` | Migrate legacy localStorage history |
| GET | `/api/settings` | API key save status & masked display |
| PUT | `/api/settings/api-key` | Save API key (persisted in SQLite) |
| DELETE | `/api/settings/api-key` | Delete saved API key |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `KIE_API_KEY` | Optional. kie.ai API key (desktop app can save via settings; stored key takes priority) |
| `PORT` | API port (default `8787`) |
| `STUDIO_DB_PATH` | Optional. Override SQLite path (desktop sets automatically; dev uses `data/studio.db`) |
| `RELEASE_BASE_URL` | Optional. Static host URL for Electrobun auto-update (empty to disable) |
| `XAI_API_KEY` | Optional. Auth for Grok CLI when not logged in |
| `SYNC_MODELS_ON_START` | `0` to disable startup sync (default on) |
| `SYNC_MODELS_FORCE` | `1` to force full sync on startup |
| `SYNC_CONCURRENCY` | Concurrency for model page fetching (default `12`, max 32) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Web + agent sidecar together (`dev:server` + `dev:web` + `dev:agent`) |
| `npm run dev:server` | Hono API only (`bun --watch server/index.ts`) |
| `npm run dev:web` | Vite dev server only |
| `npm run dev:agent` | Flue agent sidecar only (`127.0.0.1:8789`) |
| `npm run agent:build` | Build `agent/dist` (required before desktop builds) |
| `npm run desktop:dev` | Launch Electrobun desktop in dev mode (`electrobun run --env=dev`) |
| `npm run desktop:build:canary` | Canary desktop build (`vite build` + `electrobun build`) |
| `npm run desktop:build:stable` | Stable desktop build |
| `npm run desktop:package:canary` | Re-package canary (skip `vite build`; icon gen + `electrobun build` + `release/` collection) |
| `npm run desktop:package:stable` | Re-package stable |
| `npm run desktop:installer:win` | Generate Windows Inno Setup installer (requires Inno Setup 6, outputs to `release/`) |
| `npm run icons` | Generate `icon.ico` / `icon.png` / `icon.iconset` from `assets/icon-master.svg` |
| `npm run build` | Type check (`tsc -b`) + production build |
| `npm run preview` | Preview build output |
| `npm run lint` | oxlint |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run sync:models` | Manual catalog sync |

For type-check only: `npx tsc -b` (included in `npm run build`).

## Project Structure

```text
src/            # Frontend (Vite + React 19 + Tailwind v4)
  App.tsx       # Orchestrates form, queue, history, polling, Quick Actions
  components/   # UI (audio/ · shell/ · motion/, SettingsSheet, etc.)
  lib/          # API, history, queue, validation, media, models
  bun/          # Electrobun main process (index.ts: Bun.serve + BrowserWindow)
  data/catalog.json  # Model catalog regenerated by sync
server/         # Hono API (Bun runtime, 127.0.0.1:8787)
  app.ts        # createApp (CORS, onError, route registration)
  index.ts      # Dev entry (Bun.serve startup, catalog sync on boot)
  routes/       # HTTP boundary (generate / task / Suno / archive / history / settings, etc.)
  kie/adapters/ # Market / Suno / Veo / Runway normalization
  settings/     # API key retrieval (persistent store → env fallback)
  db/           # bun:sqlite (history, Persona, audio assets, app_settings)
  grok/         # Grok CLI integration (prompt optimization)
  grokOauth/    # X-account OAuth + OpenAI-compatible proxy (agent mode)
  catalog/      # docs OpenAPI + dedicated workflow integration
electrobun.config.ts    # Electrobun build & distribution config (win/linux icon paths)
docs/PRE_RELEASE.md     # Pre-release checklist (lint/test/UI/docs)
assets/icon-master.svg  # Vector master for app icon (→ icon.ico / icon.png)
installer/win/kie-studio.iss   # Inno Setup installer definition (ARP, uninstaller, shortcuts)
scripts/build-icons.mjs        # icon-master.svg → icon.ico / icon.png (sharp + png-to-ico)
scripts/embed-win-icon.mjs     # Post-build icon embed into launcher.exe + tar.zst repackage
scripts/build-win-installer.mjs # tar.zst extract → icon embed → Inno Setup compile
scripts/collect-release.mjs    # Collect build artifacts into persistent release/
scripts/sync-models.ts  # Catalog sync CLI
.github/workflows/release.yml  # 3-OS matrix build + Releases publish
.indexion/wiki/         # Project knowledge base (indexion wiki)
```

## Notes

- Uploaded files are temporary (deleted after a short period per docs)
- Generated media is deleted after ~14 days (remaining days shown in gallery). Download early if needed.
- Supported providers / operations are limited to workflows defined in the catalog
- For agent working notes see [AGENTS.md](./AGENTS.md)

## License

[GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html) — © 2025 KIE STUDIO contributors.

This project is an unofficial fan tool. You are free to use, modify, and redistribute it under the terms of the GNU General Public License v3 or later. See [LICENSE](./LICENSE) for full terms. `package.json` is `private: true`; npm publish is disabled.

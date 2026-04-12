# Lap Timer - Copilot Instructions

## Project Overview

Lap Timer is a mobile-first web application designed for calling out lap times during races. It runs as a pure client-side stopwatch — all timing uses `performance.now()` in the browser so accuracy depends on the phone, not the server.

## Architecture

- **Static web app**: Plain HTML, CSS, and vanilla JavaScript. No build step, no framework.
- **Server**: Nginx Alpine via Docker. Serves static files only — no backend logic.
- **Deployment**: `docker compose up` exposes port 8080.

## Key Files

| File | Purpose |
|---|---|
| `src/index.html` | Single-page app shell with three screens (setup, timer, results) |
| `src/style.css` | Mobile-first styles, dark theme, large touch targets |
| `src/app.js` | All stopwatch logic: timing, lap tracking, formatting, share |
| `src/manifest.json` | PWA manifest for "Add to Home Screen" |
| `Dockerfile` | Nginx Alpine image serving `src/` |
| `docker-compose.yml` | Maps port 8080 → 80 |
| `nginx.conf` | Gzip, caching, SPA fallback |

## Design Principles

1. **Phone-first UI** — Large buttons, dark theme, no tiny controls. Designed for one-handed operation.
2. **Client-side timing** — `performance.now()` drives all timing. The `requestAnimationFrame` loop updates the display. No network latency in the critical path.
3. **No dependencies** — Zero npm packages, zero build tools. The `src/` folder is the deployable artifact.
4. **Wake Lock API** — Requests a screen wake lock during timing so the phone doesn't sleep mid-race.
5. **Web Share API** — Uses Android's native share sheet to send results to WhatsApp, SMS, etc.

## Time Formats

- **Main display**: `mm:ss.ss` (e.g., `02:15.34`)
- **Lap splits**: `sss.ss s` — always in seconds, no minutes (e.g., `62.34 s` for 1m 2.34s)
- **Share text**: Each lap line shows split in seconds and cumulative total in `mm:ss.ss`

## UI Flow

1. **Setup screen** — Roller to pick number of laps (0 = unlimited), large green START button.
2. **Timer screen** — Running clock, LAP button (yellow), STOP button (red). Laps appear below with newest at top and most prominent. Shows "X laps to go" when a lap count was set.
3. **Results screen** — Final time, table of all laps with split and total times, Share button (if supported), Reset button.

## Coding Conventions

- Vanilla ES5-compatible JavaScript (no transpiler, wide device support).
- CSS custom properties for theming.
- No external CDN dependencies — everything is self-contained.
- All DOM manipulation is imperative (no virtual DOM).
- Keep the entire app in three files (HTML, CSS, JS) unless a feature genuinely requires separation.

## Running Locally

```bash
# With Docker
docker compose up --build

# Without Docker (any static file server)
cd src && python3 -m http.server 8080
```

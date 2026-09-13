# Deployment, Versioning & cross-workspace relationship

Keep the split clean:

- **`LapTimer` (this repo)** — app source of truth (a static PWA served by nginx).
- **`homelab-infra`** (sibling workspace) — the only place that knows where/what runs.

## The split

- **This repo's only job is to ship a container image.** On a `v*` release tag,
  `.github/workflows/build-push.yml` builds and publishes
  `ghcr.io/alanjwade/laptimer:<tag>`. It knows nothing about a host or deploy path.
- **homelab-infra owns all deployment.** The pinned tag, compose file, host, and
  up-to-date check live in `homelab-infra/hosts/homelab01/lap-timer/`. The
  general-purpose `scripts/update-apps.sh` there watches GHCR, bumps the pin,
  commits/pushes, then sshs to the host to pull + restart.

## Release flow

1. `./bump_release.sh` (patch) or `./bump_release.sh minor|major`. On a fresh
   repo with no tags, `./bump_release.sh major` produces `v1.0.0`. Requires a
   clean tree.
2. CI publishes `ghcr.io/alanjwade/laptimer:<tag>`.
3. Deploy from homelab-infra: `./scripts/update-apps.sh lap-timer`.

## Runtime

- Pure static site — no database, no host volumes. The container listens on :80.
- Public hostname `timer.fchsrunning.org` reaches it via
  Cloudflare Tunnel → Caddy → `lap-timer:80`.

## Note

`deploy.sh` is the legacy homelab00 rsync+rebuild flow; it is superseded by the
image pipeline + `update-apps.sh` and can be retired.
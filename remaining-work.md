# Pixdock Remaining Work

> Phase 1 complete (2026-05-06). 89 tests passing. 9/9 user stories done.

## Phase 2: Feature Expansion (Docker Management)

**Goal:** Add volumes, networks, stats, image prune, compose stack deploy.

| # | Deliverable | Backend | Frontend |
|---|---|---|---|
| 1 | Volume management (list/inspect/delete) | `docker/volumes.rs`, `GET/DELETE /api/volumes` | `VolumeList.svelte` |
| 2 | Network management (list/create/delete) | `docker/networks.rs`, `GET/POST/DELETE /api/networks` | `NetworkList.svelte` |
| 3 | Container stats streaming (CPU/mem/IO) | `docker/stats.rs`, SSE `/api/stats/stream` | `ResourceChart.svelte` (reuse `Sparkline.svelte`) |
| 4 | Image prune | `docker/images.rs`, `POST /api/images/prune` | `ImageManager.svelte` (extend `ImageList`) |
| 5 | Compose stack deploy | `POST /api/stacks/deploy` (multipart YAML) | `StackDeploy.svelte` |
| 6 | Frontend views | — | New tabs: Volumes, Networks, Images, Charts, Stacks |

## Phase 3: UX Polish & Security Hardening

**Goal:** Retro delight, RBAC, mobile, production safety.

| # | Deliverable | Backend | Frontend |
|---|---|---|---|
| 1 | 8-bit sounds (Web Audio API) | — | `stores/sound.ts`, mute toggle |
| 2 | Pixel animations (CSS keyframes) | — | `app.css`, status LEDs, toasts |
| 3 | Theme customization (16-color palette) | — | `ThemeEditor.svelte`, `stores/theme.ts` |
| 4 | Mobile responsiveness (<768px) | — | `app.css` grid collapse, bottom sheets |
| 5 | RBAC (admin/viewer via PIXDOCK_ROLE) | `auth.rs` role middleware, 403 on viewer | Role-aware UI |
| 6 | Audit log viewer (admin only) | `GET /api/audit` | `AuditLogViewer.svelte` |
| 7 | TLS guide | `docs/TLS_GUIDE.md` | — |
| 8 | Offline mode / stale-data banner | — | `utils/offline.ts`, localStorage cache |
| 9 | Container run wizard | `POST /api/containers/run` | `ContainerRunWizard.svelte` (modal) |
| 10 | Admin metrics/health viewer | — | `AdminPanel.svelte` |

## Quick Wins (low effort, high impact)

- **Frontend CI**: Run Vitest + tsc in CI (currently only backend has CI)
- **Load test**: Measure WS payload reduction after Phase 1 delta (verify >=50% drop in stable state)
- **TLS smoke test**: `docker compose` + nginx + certbot validating the TLS guide
- **E2E DinD flow**: Scripted Docker-in-Docker test covering stop/start/scale/logs

## Test Targets

| Layer | Now | Target |
|---|---|---|
| Rust unit | 50 | 60+ |
| Integration | 29 | 40+ |
| Frontend unit | 10 | 25+ |
| E2E | 0 | 7 scenarios |

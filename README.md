# [PX] PixDock

**Pixel-art Docker dashboard with retro CRT aesthetics.**

Monitor and control your Docker containers and Swarm services through a beautiful retro interface with LED indicators, HP-bar gauges, and CRT scanlines.

Works with both **Docker Swarm** and **standalone Docker** — auto-detected, zero config.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/stormixus/pixdock/main/install.sh | sh
```

Options:

```bash
# Custom port
curl -fsSL ... | sh -s -- --port 9000

# With auth token
curl -fsSL ... | sh -s -- --token my-secret

# Non-interactive (CI/automation)
curl -fsSL ... | sh -s -- --yes

# Uninstall
curl -fsSL ... | sh -s -- --uninstall
```

Requires Docker with the daemon running. Installs to `~/.pixdock/` and pulls the pre-built image from `ghcr.io/stormixus/pixdock`.

## Features

- **Auto-detect mode** — Swarm or Standalone, no configuration needed
- **Real-time updates** — Shared WebSocket broadcast every 3s (scales to many clients)
- **Container controls** — Start, stop, restart with one click
- **Container logs** — Built-in log viewer with search/filter and auto-refresh
- **Swarm support** — Node rack, services by stack, task details, replica scaling
- **Authentication** — Optional bearer token auth via `PIXDOCK_TOKEN` env var
- **Pixel-art UI** — CRT scanlines, Press Start 2P font, LED indicators, HP-bar gauges
- **Air-gap ready** — All assets self-hosted, no external dependencies
- **Tiny footprint** — Single binary, ~128MB memory limit, Alpine-based image

## Architecture

```
[Browser]  ──WebSocket──▸  [Rust/Axum]  ──Unix Socket──▸  [Docker Engine]
           ◂─broadcast──   (port 8420)    (/v1.43/ API)
```

- Single background task polls Docker, broadcasts to all connected clients
- REST API for actions (start/stop/restart/scale/logs)
- Bearer token auth on all endpoints (optional)

## Development / Build from Source

### Docker Compose

```bash
# Without auth
docker compose up --build

# With auth
PIXDOCK_TOKEN=my-secret-token docker compose up --build
```

Open http://localhost:8420

### Docker Swarm

```bash
docker build -t pixdock:latest .
docker stack deploy -c stack.yml pixdock
```

### Local Development

```bash
# Backend
cd backend && cargo run

# Frontend (dev server with hot reload)
cd frontend && npm install && npm run dev
```

## Authentication

Set `PIXDOCK_TOKEN` environment variable to enable bearer token authentication:

```bash
# docker-compose.yml
environment:
  - PIXDOCK_TOKEN=your-secret-token
```

- **REST API**: Send `Authorization: Bearer <token>` header
- **WebSocket**: Connect with `?token=<token>` query parameter
- **If unset**: Auth is disabled (open access) with a startup warning
- `/api/health` is always public

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ws` | Token (query) | WebSocket — DashboardState broadcast |
| GET | `/api/health` | No | Health check |
| GET | `/api/nodes` | Yes | Swarm nodes |
| GET | `/api/services` | Yes | Swarm services with replica counts |
| GET | `/api/containers` | Yes | All containers |
| GET | `/api/services/:id/tasks` | Yes | Tasks for a service |
| POST | `/api/services/:id/scale` | Yes | Scale service `{"replicas": N}` |
| POST | `/api/containers/:id/action` | Yes | Action `{"action": "start"\|"stop"\|"restart"}` |
| GET | `/api/containers/:id/logs` | Yes | Container logs `?tail=200&timestamps=true` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust, Axum 0.8, Tokio, Hyper |
| Frontend | Svelte 5, TypeScript, Vite 6 |
| Docker API | Unix socket, pinned to v1.43 |
| Deployment | Multi-stage Dockerfile, Compose, Swarm |
| CI | GitHub Actions (clippy, fmt, test, build) |

## Project Structure

```
pixdock/
├── backend/
│   └── src/
│       ├── main.rs              # Entry, routing, socket check
│       ├── auth.rs              # Bearer token middleware
│       ├── state.rs             # AppState (Docker + Broadcaster)
│       ├── docker/
│       │   ├── client.rs        # Versioned Unix socket HTTP client
│       │   ├── containers.rs    # Container ops + log parsing
│       │   ├── nodes.rs         # Swarm node ops
│       │   └── services.rs      # Service + task ops, scaling
│       ├── ws/
│       │   └── handler.rs       # Shared broadcast WebSocket
│       └── api/
│           └── routes.rs        # REST with input validation
├── frontend/
│   └── src/
│       ├── app.css              # Pixel theme + CRT effects
│       └── lib/
│           ├── components/
│           │   ├── Dashboard.svelte
│           │   ├── NodeRack.svelte
│           │   ├── ServiceList.svelte
│           │   ├── ContainerGrid.svelte
│           │   ├── LogViewer.svelte
│           │   ├── PixelStatusBar.svelte
│           │   └── Toast.svelte
│           ├── stores/swarm.ts
│           └── utils/ws.ts
├── Dockerfile                   # Multi-stage (Node + Rust + Alpine)
├── docker-compose.yml           # Standalone deployment
├── stack.yml                    # Swarm deployment
└── .github/workflows/ci.yml    # CI pipeline
```

## Security

- All path parameters validated against `[a-zA-Z0-9_.-]{1,128}`
- Docker API version pinned to prevent schema drift
- Optional bearer token auth (REST + WebSocket)
- Scale requests capped at 1000 replicas
- Structured JSON error responses (no information leakage)

## License

MIT

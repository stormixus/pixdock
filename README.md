# [PX] PixDock

Pixel-art style Docker dashboard. Works with both **Docker Swarm** and **standalone Docker**.

## Architecture

```
[Browser] <-WebSocket-> [Rust/Axum Server] <-Unix Socket-> [Docker Engine API]
```

## Features

- **Auto-detect mode**: Swarm or Standalone - no config needed
- **Real-time updates**: WebSocket pushes every 3s
- **Standalone mode**: Container list grouped by Compose project, start/stop/restart controls
- **Swarm mode**: Node rack, services by stack, task details, replica scaling
- **Pixel-art UI**: CRT scanlines, Press Start 2P font, LED indicators, HP-bar gauges
- **Toast notifications**: Connection status, action feedback

## Tech Stack

- **Backend**: Rust + Axum + tokio (WebSocket + REST)
- **Frontend**: Svelte 5 + TypeScript + Pixel Art CSS
- **Communication**: WebSocket (real-time) + REST (actions)
- **Deployment**: Docker Compose / Swarm stack

## Project Structure

```
pixdock/
├── backend/                 # Rust Axum server
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs          # Entry point + mode detection
│       ├── docker/
│       │   ├── client.rs    # Unix socket HTTP client
│       │   ├── containers.rs # Container operations (standalone)
│       │   ├── nodes.rs     # Node operations (swarm)
│       │   └── services.rs  # Service + task operations (swarm)
│       ├── ws/
│       │   └── handler.rs   # WebSocket: push DashboardState
│       └── api/
│           └── routes.rs    # REST: health, CRUD, actions
├── frontend/                # Svelte 5 app
│   └── src/
│       ├── app.css          # Pixel theme + CRT effects
│       ├── lib/
│       │   ├── stores/
│       │   │   └── swarm.ts # Stores + toasts
│       │   ├── components/
│       │   │   ├── Dashboard.svelte
│       │   │   ├── NodeRack.svelte      # Swarm nodes
│       │   │   ├── ServiceList.svelte   # Swarm services + scaling
│       │   │   ├── ContainerGrid.svelte # Standalone containers
│       │   │   ├── PixelStatusBar.svelte
│       │   │   └── Toast.svelte
│       │   └── utils/
│       │       └── ws.ts    # WebSocket + REST client
│       └── routes/
│           └── +page.svelte
├── docker-compose.yml       # Dev / standalone deployment
├── Dockerfile               # Multi-stage build
└── stack.yml                # Swarm deployment
```

## Quick Start

```bash
# Backend
cd backend && cargo run

# Frontend (dev)
cd frontend && npm install && npm run dev
```

## Docker Deployment

```bash
# Standalone
docker compose up --build

# Swarm
docker stack deploy -c stack.yml pixdock
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ws` | WebSocket (DashboardState every 3s) |
| GET | `/api/health` | Health check |
| GET | `/api/nodes` | Swarm nodes |
| GET | `/api/services` | Swarm services |
| GET | `/api/containers` | All containers |
| GET | `/api/services/:id/tasks` | Tasks for a service |
| POST | `/api/services/:id/scale` | Scale service `{replicas: N}` |
| POST | `/api/containers/:id/action` | Container action `{action: "start"|"stop"|"restart"}` |

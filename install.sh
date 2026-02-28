#!/bin/sh
# PixDock installer — https://github.com/stormixus/pixdock
# Usage: curl -fsSL https://raw.githubusercontent.com/stormixus/pixdock/main/install.sh | sh
set -eu

# ── Defaults ─────────────────────────────────────────────────────────────────
PIXDOCK_DIR="${PIXDOCK_DIR:-$HOME/.pixdock}"
PIXDOCK_PORT="${PIXDOCK_PORT:-8420}"
PIXDOCK_TOKEN="${PIXDOCK_TOKEN:-}"
COMPOSE_URL="https://raw.githubusercontent.com/stormixus/pixdock/main/docker-compose.prod.yml"
IMAGE="ghcr.io/stormixus/pixdock:latest"
YES=false
UNINSTALL=false

# ── Colors (only when stdout is a terminal) ──────────────────────────────────
if [ -t 1 ]; then
  DIM='\033[2m'   RESET='\033[0m'
  GREEN='\033[32m'  RED='\033[31m'  CYAN='\033[36m'  YELLOW='\033[33m'
else
  DIM='' RESET='' GREEN='' RED='' CYAN='' YELLOW=''
fi

# ── Helpers ──────────────────────────────────────────────────────────────────
info()  { printf "${CYAN}[PX]${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}[PX]${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}[PX]${RESET} %s\n" "$*"; }
fail()  { printf "${RED}[PX]${RESET} %s\n" "$*" >&2; exit 1; }

banner() {
  printf '%s' "$CYAN"
  cat <<'BANNER'

  ██████╗ ██╗██╗  ██╗██████╗  ██████╗  ██████╗██╗  ██╗
  ██╔══██╗██║╚██╗██╔╝██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝
  ██████╔╝██║ ╚███╔╝ ██║  ██║██║   ██║██║     █████╔╝
  ██╔═══╝ ██║ ██╔██╗ ██║  ██║██║   ██║██║     ██╔═██╗
  ██║     ██║██╔╝ ██╗██████╔╝╚██████╔╝╚██████╗██║  ██╗
  ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝

BANNER
  printf '%s' "$RESET"
  printf '%s  Pixel-art Docker dashboard · retro CRT aesthetics%s\n\n' "$DIM" "$RESET"
}

confirm() {
  if [ "$YES" = true ]; then return 0; fi
  printf "%s [y/N] " "$1"
  read -r answer
  case "$answer" in
    [yY]|[yY][eE][sS]) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Compose command detection ────────────────────────────────────────────────
detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  else
    fail "Neither 'docker compose' (v2) nor 'docker-compose' (v1) found."
  fi
}

# ── Uninstall ────────────────────────────────────────────────────────────────
do_uninstall() {
  banner
  info "Uninstalling PixDock..."

  if [ -f "$PIXDOCK_DIR/docker-compose.yml" ]; then
    detect_compose
    cd "$PIXDOCK_DIR"
    $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
    cd "$HOME"
  fi

  if [ -d "$PIXDOCK_DIR" ]; then
    rm -rf "$PIXDOCK_DIR"
    ok "Removed $PIXDOCK_DIR"
  else
    warn "$PIXDOCK_DIR does not exist, nothing to remove."
  fi

  ok "PixDock uninstalled."
  exit 0
}

# ── Parse CLI args ───────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --uninstall) UNINSTALL=true ;;
    --port)      shift; PIXDOCK_PORT="${1:?'--port requires a value'}" ;;
    --token)     shift; PIXDOCK_TOKEN="${1:?'--token requires a value'}" ;;
    --yes|-y)    YES=true ;;
    --help|-h)
      cat <<EOF
Usage: install.sh [OPTIONS]

Options:
  --port PORT    Set dashboard port (default: 8420)
  --token TOKEN  Set authentication token
  --uninstall    Remove PixDock containers and config
  --yes, -y      Skip confirmation prompts
  --help, -h     Show this help
EOF
      exit 0
      ;;
    *) fail "Unknown option: $1 (try --help)" ;;
  esac
  shift
done

if [ "$UNINSTALL" = true ]; then
  do_uninstall
fi

# ── Main install ─────────────────────────────────────────────────────────────
banner

# 1. Check Docker
if ! command -v docker >/dev/null 2>&1; then
  fail "Docker is not installed. Please install Docker first: https://docs.docker.com/get-docker/"
fi

if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not running. Please start Docker and try again."
fi

info "Docker detected: $(docker --version)"

# 2. Detect compose
detect_compose
info "Compose command: $COMPOSE_CMD"

# 3. Detect Swarm mode
if docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q "active"; then
  info "Swarm mode: active"
else
  info "Swarm mode: inactive (standalone)"
fi

# 4. Confirm
printf "\n"
info "Install directory: $PIXDOCK_DIR"
info "Dashboard port:    $PIXDOCK_PORT"
if [ -n "$PIXDOCK_TOKEN" ]; then
  info "Auth token:        (set)"
else
  info "Auth token:        (disabled)"
fi
printf "\n"

confirm "Install PixDock?" || { info "Aborted."; exit 0; }
printf "\n"

# 5. Create directory
mkdir -p "$PIXDOCK_DIR"

# 6. Download compose file
info "Downloading compose file..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$COMPOSE_URL" -o "$PIXDOCK_DIR/docker-compose.yml"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$PIXDOCK_DIR/docker-compose.yml" "$COMPOSE_URL"
else
  fail "Neither curl nor wget found. Cannot download compose file."
fi

# 7. Write .env
cat > "$PIXDOCK_DIR/.env" <<EOF
PIXDOCK_PORT=$PIXDOCK_PORT
PIXDOCK_TOKEN=$PIXDOCK_TOKEN
EOF

# 8. Pull image
info "Pulling image: $IMAGE"
docker pull "$IMAGE"

# 9. Start
info "Starting PixDock..."
cd "$PIXDOCK_DIR"
$COMPOSE_CMD up -d

printf "\n"
ok "================================================"
ok "  PixDock is running!"
ok "  Open: http://localhost:${PIXDOCK_PORT}"
if [ -n "$PIXDOCK_TOKEN" ]; then
  ok "  Token: (set via --token or PIXDOCK_TOKEN)"
fi
ok "================================================"
printf "\n"
info "Config dir: $PIXDOCK_DIR"
info "Stop:       cd $PIXDOCK_DIR && $COMPOSE_CMD down"
info "Uninstall:  curl -fsSL https://raw.githubusercontent.com/stormixus/pixdock/main/install.sh | sh -s -- --uninstall"

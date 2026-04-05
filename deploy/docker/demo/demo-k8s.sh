#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="ace-demo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
AMBER='\033[0;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[info]${NC}  $*"; }
warn()  { echo -e "${AMBER}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

# --- Preflight checks --------------------------------------------------------

check_cmd() {
  command -v "$1" &>/dev/null || error "$1 is required but not installed. Install it first."
}

info "Checking prerequisites..."
check_cmd docker
check_cmd k3d
check_cmd kubectl
check_cmd tilt
check_cmd helm

# Verify Docker is running
docker info &>/dev/null || error "Docker is not running. Start Docker first."

# --- Create k3d cluster -------------------------------------------------------

if k3d cluster list 2>/dev/null | grep -q "$CLUSTER_NAME"; then
  info "k3d cluster '$CLUSTER_NAME' already exists"
else
  info "Creating k3d cluster '$CLUSTER_NAME'..."
  k3d cluster create "$CLUSTER_NAME" \
    --agents 1 \
    --port "3000:3000@loadbalancer" \
    --port "5173:80@loadbalancer" \
    --port "8080:8080@loadbalancer" \
    --port "8428:8428@loadbalancer" \
    --port "9428:9428@loadbalancer" \
    --port "10428:10428@loadbalancer" \
    --wait
  info "Cluster created"
fi

# Ensure kubectl context is set
kubectl config use-context "k3d-$CLUSTER_NAME" &>/dev/null

# --- Launch Tilt --------------------------------------------------------------

info ""
info "Starting Ace VM Migration Demo on Kubernetes..."
info ""
info "  Ace UI:            http://localhost:5173"
info "  Grafana:           http://localhost:3000  (3 pre-installed dashboards)"
info "  Ace API:           http://localhost:8080"
info "  VictoriaMetrics:   http://localhost:8428"
info "  VictoriaLogs:      http://localhost:9428"
info "  VictoriaTraces:    http://localhost:10428"
info ""
info "Tilt dashboard will open at http://localhost:10350"
info "Press Ctrl+C in the Tilt UI to stop."
info ""

cd "$REPO_ROOT"
exec tilt up -f Tiltfile.demo

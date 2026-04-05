# Ace VM Migration Demo

Demo environment for Ace with VictoriaMetrics, Grafana (3 pre-installed dashboards), and a correlated telemetry generator. Two deployment options.

## Quick Start

### Docker Compose (simple)

```bash
cd deploy/docker/demo
./run.sh
```

### k3d + Tilt (Kubernetes)

```bash
# From repo root:
make demo
```

Creates a k3d cluster, builds images, deploys via Helm, and opens the Tilt dashboard. Requires: Docker, k3d, tilt, kubectl, helm.

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Ace UI | http://localhost:5173 | Dashboard frontend |
| Grafana | http://localhost:3000 | Source dashboards (3 pre-installed) |
| Ace API | http://localhost:8080 | Backend API |
| VictoriaMetrics | http://localhost:8428 | Metrics storage |
| VictoriaLogs | http://localhost:9428 | Log storage |
| VictoriaTraces | http://localhost:10428 | Trace storage |
| Tilt dashboard | http://localhost:10350 | k3d only — service status |

## Full Demo Guide

See **[DEMO_GUIDE.md](DEMO_GUIDE.md)** for the complete walkthrough, 10-minute demo script, and troubleshooting.

## Stop

```bash
# Docker Compose
docker compose down -v

# k3d + Tilt
make demo-down
```

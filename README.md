# Ace - Monitoring Dashboard

[![CodeQL](https://github.com/aceobservability/ace/actions/workflows/security.yml/badge.svg?branch=master)](https://github.com/aceobservability/ace/actions/workflows/security.yml)
[![Lint](https://github.com/aceobservability/ace/actions/workflows/lint.yml/badge.svg?branch=master)](https://github.com/aceobservability/ace/actions/workflows/lint.yml)
[![Security](https://github.com/aceobservability/ace/actions/workflows/security.yml/badge.svg?branch=master)](https://github.com/aceobservability/ace/actions/workflows/security.yml)

A Grafana-like monitoring dashboard built with Vue.js, Go, and Prometheus.

## Features

- **AI-powered chat-to-dashboard** — type a natural language prompt, get a complete dashboard with the right queries and panels
- **GitHub Copilot integration** — AI query assistant with tool-calling for metric discovery
- Dashboard CRUD operations with 12-column grid layout
- Multi-datasource support (VictoriaMetrics, Prometheus, ClickHouse, Elasticsearch, CloudWatch, Loki, Tempo)
- PromQL/MetricsQL query editor with syntax highlighting
- Line, bar, gauge, stat, pie, and table visualizations (ECharts)
- Time range picker with presets, custom ranges, and auto-refresh
- Drag-and-drop dashboard layout
- Dark/light mode with organization-level theming
- Log-to-trace correlation
- Alert management (VMAlert, Alertmanager)

## Tech Stack

- **Frontend:** Vue.js 3 (Composition API + TypeScript)
- **Backend:** Go API
- **Database:** PostgreSQL (metadata storage)
- **Cache:** Valkey (Redis-compatible)
- **Data Sources:** VictoriaMetrics, Prometheus, ClickHouse, Elasticsearch, Loki, Tempo

## Quick Start

### Prerequisites

| Tool | Version | Required for | Install |
|------|---------|-------------|---------|
| Go | 1.25+ | Backend | [go.dev](https://go.dev/dl/) or `mise install` |
| Node.js | 18+ | Frontend | [nodejs.org](https://nodejs.org/) |
| Docker | latest | Both paths | [docker.com](https://docs.docker.com/get-docker/) |

> **Tip:** This project includes a [`mise.toml`](mise.toml) that pins tool versions. If you use [mise](https://mise.jdx.dev/), run `mise install` to get the correct versions.

There are two ways to run the local dev environment. Pick whichever suits you:

| | Docker Compose | Tilt + Kubernetes |
|---|---|---|
| **Infra** | Docker only | Local k8s cluster (Colima, kind, or Docker Desktop) |
| **Backend** | Runs on host (`make backend`) | Built and deployed as a container |
| **Frontend** | Runs on host (`make frontend`) | Managed by Tilt |
| **Hot reload** | Backend via air, frontend via Vite | Backend rebuilds container, frontend via Vite |
| **Extra tools** | None | `kubectl`, `helm`, `tilt` |
| **Best for** | Quick start, lightweight | Full orchestration, closer to production |

---

### Option A: Docker Compose

The simplest way to get started. Docker Compose runs the infrastructure (postgres, valkey, datasource backends) and you run the backend and frontend on the host.

#### 1. Start infrastructure

```bash
# Core services (postgres + valkey)
make compose-up

# Or with datasource backends
make compose-up PROFILES=victoria
```

Available profiles: `victoria`, `lgtm`, `elk`, `clickhouse`

#### 2. Start backend and frontend

```bash
# Terminal 1 — backend (hot reload with air, or plain go run)
make backend

# Terminal 2 — frontend (Vite dev server)
make frontend
```

#### 3. Seed test data

```bash
make seed
# defaults: EMAIL=admin@admin.com PASSWORD=Admin1234
```

#### 4. Open the app

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080

#### Stop

```bash
make compose-down

# Or tear down and delete volumes
make compose-reset
```

---

### Option B: Tilt + Kubernetes

Tilt orchestrates everything in a local Kubernetes cluster — infrastructure, backend container builds, and the frontend dev server. This is closer to how Ace runs in production.

#### Additional prerequisites

| Tool | Install |
|------|---------|
| kubectl | [kubernetes.io](https://kubernetes.io/docs/tasks/tools/) |
| Helm | [helm.sh](https://helm.sh/docs/intro/install/) |
| Tilt | [tilt.dev](https://docs.tilt.dev/install.html) |
| Local k8s cluster | See below |

#### 1. Start a local Kubernetes cluster

**Colima (recommended on macOS):**
```bash
colima start --kubernetes --cpu 4 --memory 8
colima kubernetes reset   # one-time: ensures k3s starts cleanly
```

**kind:**
```bash
kind create cluster
```

**Docker Desktop:** Enable Kubernetes in Docker Desktop settings and restart.

#### 2. Start the dev environment

```bash
make tilt-up
```

This deploys core services to your local cluster:
- **postgres** — metadata database (localhost:5432)
- **valkey** — cache/session store (localhost:6379)
- **backend** — Go API (http://localhost:8080)
- **frontend** — Vite dev server with hot reload (http://localhost:5173)

Open the Tilt UI (URL shown in terminal output) to monitor service health.

#### 3. Enable datasource backends

Datasource backends are disabled by default. Enable them at startup:

```bash
make tilt-up ENABLE="victoria-metrics victoria-logs"
```

Or enable any combination:

```bash
# Prometheus + Loki + Tempo
make tilt-up ENABLE="prometheus loki tempo"

# Everything
make tilt-up ENABLE="prometheus loki victoria-metrics victoria-logs tempo"
```

You can also enable services from the Tilt UI after startup.

| Service | Port | Enable name |
|---------|------|-------------|
| Prometheus | http://localhost:9090 | `prometheus` |
| Loki | http://localhost:3100 | `loki` |
| VictoriaMetrics | http://localhost:8428 | `victoria-metrics` |
| Victoria Logs | http://localhost:9428 | `victoria-logs` |
| Tempo | http://localhost:3200 | `tempo` |

#### 4. Seed test data

```bash
make seed
# defaults: EMAIL=admin@admin.com PASSWORD=Admin1234
```

#### Stop

```bash
make tilt-down

# To also stop Colima:
colima stop
```

---

## Datasource Ports

Regardless of which path you choose, datasource services use the same local ports:

| Service | Port |
|---------|------|
| PostgreSQL | localhost:5432 |
| Valkey | localhost:6379 |
| Prometheus | http://localhost:9090 |
| Loki | http://localhost:3100 |
| VictoriaMetrics | http://localhost:8428 |
| Victoria Logs | http://localhost:9428 |
| Tempo | http://localhost:3200 |

## Seed Correlated Data

Generate correlated logs and traces for testing log-to-trace correlation:

```bash
make seed-correlated
# defaults: LOKI_URL=http://localhost:3100 TEMPO_URL=http://localhost:3200 COUNT=20
```

## Testing

```bash
# All tests
make test

# Backend only
make backend-test

# Frontend only
make frontend-test
```

## Linting

```bash
# All linters
make lint

# Backend only (golangci-lint)
make backend-lint

# Frontend only (Biome + Knip)
make frontend-lint
```

## Security Scans

```bash
make security-local
```

Runs `govulncheck` against the backend and `gitleaks` against the repository (both via Docker).

## Full Quality Check

```bash
make check
```

Runs tests, linting, and security scans, then prints a summary table.

## Elasticsearch (ELK) Datasource

Ace queries Elasticsearch directly for both logs and metrics aggregations. To use it locally:

1. Start the ELK profile: `make compose-up PROFILES=elk`
2. Add an Elasticsearch datasource in **Data Sources > Add Data Source**:
   - URL: `http://localhost:9200`
   - Default Index Pattern: `dash-logs-*`

Query examples:
- **Logs:** Lucene query string — `service.name:"backend" AND level:error`
- **Metrics:** JSON body with `aggs` for date histogram timeseries

## Container Images

Public multi-arch images are published to GHCR on every release:

```bash
docker pull ghcr.io/aceobservability/ace-backend:latest
docker pull ghcr.io/aceobservability/ace-frontend:latest
```

Tag strategy: `vX.Y.Z`, `X.Y.Z`, `X.Y`, `X`, `latest`, `sha-<commit>`

See [RELEASE.md](RELEASE.md) for the maintainer workflow and versioning rules.

## Project Structure

```
ace/
├── frontend/           # Vue.js 3 application
│   ├── src/
│   └── package.json
├── backend/            # Go API
│   ├── cmd/api/        # Application entrypoint
│   ├── cmd/seed/       # Database seeder
│   ├── internal/       # Private application code
│   │   ├── handlers/   # HTTP handlers
│   │   ├── models/     # Data models
│   │   └── db/         # Database connection and migrations
│   └── pkg/            # Public packages
├── deploy/
│   ├── charts/         # Helm charts for local and production
│   └── docker/         # Docker Compose for local infra
├── agent/              # Ralph agent for automated development
├── Tiltfile            # Local dev orchestration (Tilt + Helm)
├── Makefile            # Developer workflow targets
└── mise.toml           # Tool version pinning
```

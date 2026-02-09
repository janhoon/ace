# Dash - Monitoring Dashboard

A Grafana-like monitoring dashboard built with Vue.js, Go, and Prometheus.

## Tech Stack

- **Frontend:** Vue.js 3 (Composition API + TypeScript)
- **Backend:** Go API
- **Database:** PostgreSQL (metadata storage)
- **Data Source:** Prometheus

## Features (Planned)

- Dashboard CRUD operations
- Panel system with 12-column grid layout
- Time range picker with presets and custom ranges
- Prometheus data source integration
- PromQL query editor
- Line chart visualizations (ECharts)
- Auto-refresh at configurable intervals
- Drag-and-drop dashboard layout

## Development

### Prerequisites

- Node.js 18+
- Go 1.25+
- Docker and Docker Compose

### Setup

1. Start the infrastructure services:
   ```bash
   docker-compose up -d
   ```
   This starts the OpenTelemetry Collector, which tails Docker container logs and ships them to both Loki and Victoria Logs.

2. Start the backend API:
   ```bash
   make backend
   ```
   The API will be available at http://localhost:8080 and auto-reloads on Go file changes.

   If you want to run without hot reload:
   ```bash
   cd backend
   go run ./cmd/api
   ```

3. Start the frontend dev server:
   ```bash
   cd frontend
   npm install
   cd ..
   make frontend
   ```
   The frontend will be available at http://localhost:5173

   You can also still run backend/frontend commands directly from their folders.

### Seed First Admin

Create the first admin user and organization:

```bash
make seed-admin
# defaults: EMAIL=admin@admin.com PASSWORD=Admin1234 ORG=default

# or override values
make seed-admin EMAIL=admin@example.com PASSWORD='AdminPass123' ORG='My Company' NAME='First Admin'
```

This also seeds four default datasources for the new organization:
Prometheus (`http://localhost:9090`), VictoriaMetrics (`http://localhost:8428`),
Loki (`http://localhost:3100`), and Victoria Logs (`http://localhost:9428`).

If the admin user/org already exists, seed only the default datasources:

```bash
make seed-datasources
# default ORG=default

# or for another organization slug
make seed-datasources ORG=my-company
```

### Running Tests

Frontend:
```bash
cd frontend
npm run type-check
npm run test
```

Backend:
```bash
cd backend
go test ./...
```

### Running Linting

From repo root:
```bash
make lint
```

Run backend lint only:
```bash
make backend-lint
```

Run frontend lint only:
```bash
make frontend-lint
```

Or run commands directly:

Backend:
```bash
cd backend
golangci-lint run ./...
```

Frontend:
```bash
cd frontend
npm run lint
npm run lint:dead-code
```

### Running Security Scans Locally

From repo root:

```bash
make security-local
```

This runs:

- `govulncheck` against `backend/` in a Go `1.25.7` Docker container
- `gitleaks` against the full repository via Docker

### API Endpoints

- `GET /api/health` - Health check endpoint

## Project Structure

```
dash/
├── frontend/           # Vue.js 3 application
│   ├── src/
│   └── package.json
├── backend/            # Go API
│   ├── cmd/api/        # Application entrypoint
│   ├── internal/       # Private application code
│   │   ├── handlers/   # HTTP handlers
│   │   ├── models/     # Data models
│   │   └── db/         # Database connection and migrations
│   └── pkg/            # Public packages
├── agent/              # Ralph agent for automated development
├── docker-compose.yml  # Local infra services (DB, metrics, logs)
├── otel-collector.yml  # Docker log shipping to Loki + Victoria Logs
└── README.md
```

# VM Migration Demo — Guide

This guide walks through the Ace demo environment for the VictoriaMetrics partnership conversation. The demo shows a complete migration path: connect VictoriaMetrics, import Grafana dashboards, and see metrics/logs/traces in one workspace with enterprise auth included free.

## Two Ways to Run

| Method | Command | Best for |
|--------|---------|----------|
| **Docker Compose** | `./run.sh` | Quick laptop demo, minimal dependencies |
| **k3d + Tilt** | `./demo-k8s.sh` | Full Kubernetes experience, realistic deployment |

Both methods produce the same services at the same URLs.

## Prerequisites

**Docker Compose method:**
- Docker and Docker Compose

**k3d + Tilt method (recommended for the VM demo):**
- Docker
- [k3d](https://k3d.io/) — `brew install k3d` or `curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash`
- [Tilt](https://tilt.dev/) — `brew install tilt-dev/tap/tilt` or `curl -fsSL https://raw.githubusercontent.com/tilt-dev/tilt/master/scripts/install.sh | bash`
- kubectl — `brew install kubectl`
- Helm — `brew install helm`

Ports needed: 3000, 5173, 8080, 8428, 9428, 10428

## Starting the Demo

### Option A: Docker Compose

```bash
cd deploy/docker/demo
./run.sh
```

### Option B: k3d + Tilt (Kubernetes)

```bash
# From repo root:
make demo

# Or directly:
./deploy/docker/demo/demo-k8s.sh
```

This creates a `k3d-ace-demo` cluster, builds all images, deploys via Helm, and opens the Tilt dashboard at http://localhost:10350. The Tilt UI shows the status of every service and lets you trigger rebuilds.

To tear down:

```bash
make demo-down
# Or: k3d cluster delete ace-demo
```

Wait ~90 seconds for all pods to be ready (watch the Tilt dashboard). The demo environment includes:

| Service | URL | Purpose |
|---------|-----|---------|
| **Ace** | http://localhost:5173 | The product being demoed |
| **Grafana** | http://localhost:3000 | Source instance (dashboards to migrate from) |
| VictoriaMetrics | http://localhost:8428 | Metrics backend |
| VictoriaLogs | http://localhost:9428 | Logs backend |
| VictoriaTraces | http://localhost:10428 | Traces backend |

A sample app generates correlated metrics, logs, and traces continuously via OpenTelemetry, so there is always live data flowing.

## Pre-Installed Grafana Dashboards

Grafana comes provisioned with three dashboards that exercise different panel types:

| Dashboard | Panels | Types Used |
|-----------|--------|------------|
| **VictoriaMetrics Overview** | 9 | stat, timeseries, gauge |
| **Node Exporter Full** | 11 | gauge, stat, bargauge, timeseries, table |
| **HTTP Service Overview** | 9 | stat, timeseries, piechart, heatmap |

These dashboards use template variables (`$instance`, `$job`, `$handler`, `$disk`), field overrides, and multiple queries per panel — all features the converter handles.

## Demo Walkthrough

### Act 1 — First-Run Experience

1. Open **http://localhost:5173**
2. Register a new account (any email/password — this is local)
3. The **Setup Wizard** appears automatically:
   - Click **Get Started**
   - Click **VictoriaMetrics** (highlighted as recommended)
   - This navigates to datasource settings

4. In datasource settings, add:
   - **Name:** VictoriaMetrics
   - **Type:** VictoriaMetrics
   - **URL:** `http://victoriametrics:8428`
   - Click **Test Connection** → should show success
   - Save

**Key message:** "Connect your VM instance in 30 seconds. No configuration files, no Helm chart editing."

### Act 2 — Grafana Dashboard Import

This is the core migration story. Two import methods:

#### Method A: Connect to Grafana (Auto-Discovery)

1. Go to **Dashboards** → click **+ New Dashboard**
2. Click **Import Grafana** tab
3. Switch to the **Connect to Grafana** sub-tab
4. Enter URL: `http://grafana:3000`
5. (No API key needed — Grafana has anonymous auth enabled)
6. Click **Connect** — shows "Connected to Grafana 11.4.0"
7. Browse the dashboard list — all three pre-installed dashboards appear
8. Click **VictoriaMetrics Overview** to import it
9. The **fidelity report** shows:
   - Fidelity percentage (should be ~100% for this dashboard)
   - Panel-by-panel mapping status
   - Template variables detected
10. Click **Import Dashboard**
11. The dashboard opens with live data from VictoriaMetrics

**Key message:** "Point at your Grafana instance, pick dashboards, import. No JSON export needed."

#### Method B: Upload JSON (Manual)

1. Open **http://localhost:3000** (Grafana) in another tab
2. Navigate to the **Node Exporter Full** dashboard
3. Click the share icon → **Export** → **Save to file** (or copy JSON)
4. Back in Ace: **Dashboards** → **+ New Dashboard** → **Import Grafana** → **Upload JSON**
5. Drop the JSON file or paste it
6. Click **Convert to Ace**
7. The fidelity report shows:
   - 11 panels mapped
   - Panel types: gauge, stat, bargauge → bar_gauge, timeseries → line_chart, table
   - 2 template variables ($instance, $disk)
   - Field overrides dropped count
8. The **datasource mapping** section shows "VictoriaMetrics" → select your Ace datasource
9. Click **Import Dashboard**

**Key message:** "80%+ of Grafana dashboards import with zero manual work. The fidelity report shows exactly what transfers."

### Act 3 — Logs and Traces

1. Navigate to **Explore** → **Logs**
2. Select the VictoriaLogs datasource (add it first if needed: `http://victorialogs:9428`)
3. Run a LogsQL query: `*`
4. See live log entries from the sample app
5. Click a trace ID in any log entry → navigates to the trace view

6. Navigate to **Explore** → **Traces**
7. Select the VictoriaTraces datasource (add: `http://victoriatraces:10428`)
8. Search by service name → see trace list
9. Click a trace → see the span detail

**Key message:** "Metrics, logs, and traces in one workspace. No separate Grafana plugins needed."

### Act 4 — Enterprise Features (Already Built)

These features are already live and require no setup:

1. **RBAC:** Go to **Settings** → **Members** → show the role selector (Admin, Editor, Viewer, Auditor)
2. **SSO:** Go to **Settings** → **Authentication** → show Google, Microsoft, Okta SSO configuration
3. **Audit Log:** Go to **Audit Log** → show the append-only activity log

**Key message:** "Enterprise auth — RBAC, SSO, audit logging — all included in open-source Ace. No enterprise license. No paywall."

### Act 5 — Templates (Quick Win)

If the prospect doesn't have Grafana dashboards to migrate:

1. During the Setup Wizard, click **Install Templates**
2. Three pre-built dashboards install instantly:
   - VictoriaMetrics Cluster Health
   - Node Exporter
   - Go Runtime
3. These show live data immediately

**Key message:** "Get started in 60 seconds, even without existing dashboards."

## Demo Script (Condensed)

For a 10-minute demo, hit these beats in order:

| Time | Beat | Action |
|------|------|--------|
| 0:00 | Setup | Open Ace, register, connect VM datasource |
| 1:30 | Migration | Connect to Grafana, browse dashboards, import VM Overview |
| 3:30 | Fidelity | Show the fidelity report, explain panel mappings |
| 4:30 | Live data | Open imported dashboard, show live metrics from VM |
| 5:30 | Second import | Import Node Exporter (different panel types — gauge, table, bargauge) |
| 6:30 | Logs | Explore → Logs, run a query, click a trace ID |
| 7:30 | Traces | See the trace detail view |
| 8:00 | Enterprise | Flash RBAC roles, SSO config page, audit log |
| 9:00 | Pricing | "Everything you just saw ships free and open source" |
| 9:30 | Q&A | |

## What the Fidelity Report Shows

When importing a dashboard, the fidelity report gives a trust signal:

- **Fidelity %** — percentage of panels that mapped cleanly
- **Mapped** — panel type has a direct Ace equivalent (e.g. timeseries → line_chart)
- **Unsupported** — panel type has no direct equivalent, falls back to line_chart (e.g. a Grafana plugin panel)
- **Partial** — panel mapped but has no query expression
- **Variables** — count of template variables extracted ($instance, $job, etc.)
- **Field overrides dropped** — Grafana field overrides that don't transfer (color, threshold overrides). These are noted but don't block the import.

### Panel Type Mapping Reference

| Grafana Type | Ace Type | Status |
|-------------|----------|--------|
| timeseries, graph | line_chart | Mapped |
| stat | stat | Mapped |
| gauge | gauge | Mapped |
| table | table | Mapped |
| piechart | pie | Mapped |
| bargauge | bar_gauge | Mapped |
| barchart | bar_chart | Mapped |
| heatmap | heatmap | Mapped |
| histogram | histogram | Mapped |
| logs | logs | Mapped |
| Other/plugin | line_chart | Unsupported (fallback) |

## Troubleshooting

**Grafana "Connect" fails with SSRF error:**
The Grafana auto-discovery backend blocks private network IPs for security. In the demo Docker/k8s network, `http://grafana:3000` resolves to a private IP. If this happens, use Method B (manual JSON upload) instead, or access Grafana at `http://localhost:3000` and export JSON from the browser.

**No live data in imported dashboards:**
The sample app needs ~30–60 seconds after startup to begin generating telemetry. Wait a moment and refresh. On k3d, check the `telemetrygen` pod status in the Tilt dashboard.

**Template variables show "No options loaded":**
Variable query resolution (executing `label_values(...)` queries) is scoped to metrics datasources for the demo. Variables appear as dropdowns but may not auto-populate options until the datasource has matching series.

**k3d: Ports already in use:**
If you have other services on ports 3000, 5173, or 8080, stop them first. Or delete the existing cluster (`k3d cluster delete ace-demo`) and re-run.

**k3d: Pods stuck in ImagePullBackOff:**
This means the Docker images weren't imported into the k3d registry. Tilt handles this automatically, but if you see this, try `tilt down -f Tiltfile.demo && tilt up -f Tiltfile.demo` to rebuild.

**k3d: Slow first start:**
The first `make demo` builds all Docker images and loads them into k3d. Subsequent runs are faster because images are cached. Expect 2–3 minutes on first run.

## Stopping the Demo

**Docker Compose:**
```bash
docker compose down       # Stop services, keep data
docker compose down -v    # Stop and delete all data
```

**k3d + Tilt:**
```bash
# Press Ctrl+C in the Tilt terminal, then:
make demo-down

# Or manually:
tilt down -f Tiltfile.demo
k3d cluster delete ace-demo
```

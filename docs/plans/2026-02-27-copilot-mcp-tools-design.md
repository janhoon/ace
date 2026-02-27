# Copilot MCP Tools — VictoriaMetrics

## Goal

Add MCP-style tool calling to the copilot chat so the LLM can interactively query VictoriaMetrics metadata and write/run queries in the UI. The copilot chat becomes a persistent, always-visible sidebar across all application pages.

## Architecture

Frontend-orchestrated tool loop. The frontend acts as the MCP client:

1. Sends user messages + tool definitions to GitHub Copilot API (via existing backend proxy)
2. When the model responds with tool calls, the frontend executes them:
   - **Data tools** → calls backend REST endpoints to fetch data from VictoriaMetrics
   - **UI tools** → directly manipulates the editor on the current page
3. Sends tool results back to the model in the next request
4. Loops until the model produces a final text response (max 10 iterations)

The backend's role is minimal — proxy the chat request (passing through tool definitions and tool_calls responses) and serve datasource metadata endpoints.

## Tools

Five tools, all scoped to the user's currently selected VictoriaMetrics datasource:

### `get_metrics`

- **Parameters:** `search` (optional string filter)
- **Backend:** Proxies to VictoriaMetrics `/api/v1/label/__name__/values`
- **Returns:** List of metric names

### `get_labels`

- **Parameters:** `metric` (optional string — filter labels for a specific metric)
- **Backend:** Proxies to `/api/v1/labels` with optional `match[]` param
- **Returns:** List of label names

### `get_label_values`

- **Parameters:** `label` (required string), `metric` (optional string filter)
- **Backend:** Proxies to `/api/v1/label/{label}/values` with optional `match[]`
- **Returns:** List of values for that label

### `write_query`

- **Parameters:** `query` (required string — MetricsQL expression)
- **Execution:** Frontend inserts query into the current context:
  - If on Explore metrics page → inserts into editor
  - If on dashboard panel edit → inserts into panel query editor
  - Otherwise → navigates to Explore metrics page, then inserts
- **Returns:** Confirmation string (e.g. "Query written to Explore metrics editor")

### `run_query`

- **Parameters:** none (executes whatever is currently in the editor)
- **Execution:** Triggers query execution on the current Explore/panel editor
- **Returns:** Confirmation string (e.g. "Query executed")

## Copilot Panel — Always Visible

Move `CopilotPanel.vue` from the dashboard detail view to the app-level layout (authenticated layout wrapper). It becomes a persistent right sidebar across all routes.

- Positioned after `<router-view>`, same pattern as the left nav sidebar but on the right
- 320px width, collapsible/toggleable via a button in the top nav bar
- Persists chat history and connection state across route changes (already handled by the `useCopilot` composable singleton)
- Aware of current route/page context so UI tools know where to act

## Tool Loop

The `useCopilot` composable is extended with a tool-calling loop:

1. User sends message
2. Composable builds the request: messages array + tool definitions (scoped to current datasource type)
3. Sends to `/api/copilot/chat` (existing backend proxy)
4. Parses response:
   - **Text response** → display in chat, done
   - **Tool calls** → execute each tool, collect results, append to messages, go to step 3
5. Max 10 iterations to prevent runaway loops

Tool definitions are only included when the current datasource type is `victoriametrics`. The existing MetricsQL system prompt continues to provide query language guidance.

## Editor Bridge

A `useQueryEditor` composable provides the bridge between the copilot tools and the page editors:

- Each page with a query editor (Explore metrics, panel edit) registers its editor instance via `useQueryEditor().register({ setQuery, execute })`
- `write_query` tool calls `useQueryEditor().setQuery(query)`
- `run_query` tool calls `useQueryEditor().execute()`
- If no editor is registered (user is on settings, alerts, etc.), `write_query` navigates to Explore metrics first, then writes after navigation completes

## Backend Additions

Three new metadata proxy endpoints:

- `GET /api/orgs/:orgId/datasources/:dsId/metrics?search=...`
- `GET /api/orgs/:orgId/datasources/:dsId/labels?metric=...`
- `GET /api/orgs/:orgId/datasources/:dsId/label-values/:label?metric=...`

These are thin proxies in the Go backend that forward requests to the VictoriaMetrics instance, handling auth, URL resolution, and org-scoping. This abstracts the datasource API details from the frontend and sets up the pattern for other datasource types.

The existing `/api/copilot/chat` endpoint is updated to:
- Accept and pass through `tools` in the request body
- Handle `tool_calls` in the response format (not just streamed text)

## Extensibility

Designed for future datasource support:
- Tool definitions are scoped per datasource type — other types (Prometheus, Loki, Tempo) add their own tool sets
- Backend metadata endpoints follow a uniform pattern across datasource types
- The `useQueryEditor` bridge is datasource-agnostic

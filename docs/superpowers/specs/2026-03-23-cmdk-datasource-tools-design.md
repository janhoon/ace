# Cmd+K Chat: Fix Datasource Tool Execution & Add list_datasources Tool

**Date:** 2026-03-23
**Status:** Approved

## Problem

The Cmd+K chat panel fails to run tools (`get_metrics`, `get_labels`, `get_label_values`) with `{"error":"invalid datasource id"}`. Two root causes:

1. **No view passes `datasourceId` in command context.** Every `registerContext()` call only sets `viewName`, `viewRoute`, and `description`. `CmdKModal.vue` falls back to `''`, which the backend rejects as an invalid UUID.
2. **No tool exists for datasource discovery.** When no context is available, the AI model has no way to find out which datasources exist.

## Solution

### A. Context Propagation (Explore tabs to CmdK)

**Files changed:** `UnifiedExploreView.vue`, `MetricsExploreTab.vue`, `LogsExploreTab.vue`

- `MetricsExploreTab` and `LogsExploreTab` emit a `datasource-changed` event with `{ id, name, type }` when the user selects a datasource.
- `UnifiedExploreView` listens to the event and calls `registerContext()` with `datasourceId`, `datasourceName`, and `datasourceType` included.
- Other views (Home, Settings, Alerts, Services, DashboardGen, DashboardDetail) remain unchanged — no datasource in context.

### B. `list_datasources` Tool

**Files changed:** `useCopilotTools.ts`, `CmdKChatView.vue`

New tool definition:
- **Name:** `list_datasources`
- **Description:** List all datasources available in the current organization. Use this to discover datasource IDs before querying metrics or labels.
- **Parameters:** none
- **Returns:** JSON array of `{ id, name, type }` objects

Executor changes:
- `useCopilotToolExecutor` signature changes from `(datasourceId: () => string)` to `(datasourceId: () => string, orgId: () => string)`.
- `CmdKChatView` passes `orgId` from `useOrganization().currentOrg.value?.id`.
- The `list_datasources` case calls `listDataSources(orgId)` from `api/datasources.ts` (already exists).

### C. Datasource ID Override in Discovery Tools

**Files changed:** `useCopilotTools.ts`

- `get_metrics`, `get_labels`, and `get_label_values` each gain an optional `datasource_id` string parameter: "Override the default datasource. Use an ID from list_datasources."
- In the executor switch cases: `const dsId = args.datasource_id || datasourceId()`.
- This allows the model to select a datasource via `list_datasources` and pass it explicitly to subsequent tools.

### D. Frontend System Message for Tool Guidance

**Files changed:** `CmdKChatView.vue`

`buildChatRequestMessages()` prepends a system message before the conversation history:

- **With context:** "You have tools to explore datasource data. You are currently working with datasource '{datasourceName}' (type: {datasourceType}, id: {datasourceId}). You can use get_metrics, get_labels, and get_label_values directly."
- **Without context (empty datasourceId):** "You have tools to explore datasource data. No datasource is currently selected. Call list_datasources first to discover available datasources, then pass the datasource_id to other tools."

This message is separate from the backend's system prompt (which provides query-language expertise).

## Edge Cases & Error Handling

- **Empty `orgId`:** If `useOrganization().currentOrg.value?.id` is undefined when `list_datasources` is called (org not yet loaded), the executor returns `"Error: no organization selected"` without making an API call.
- **`list_datasources` API failure:** If `listDataSources(orgId)` throws, the existing `executeTool` catch handler in `CmdKChatView.vue` (line 109) catches it and returns `"Error: {message}"` to the model, which can relay the error to the user.
- **Empty `datasourceId` with no override:** If the context datasource is empty and the model calls `get_metrics`/`get_labels`/`get_label_values` without passing `datasource_id`, the executor returns `"Error: no datasource selected. Call list_datasources first to get a datasource ID."` instead of hitting the backend with an invalid UUID.

## Scope Boundaries

- No backend changes — existing endpoints cover all needs.
- No new API endpoints — `GET /api/orgs/{orgId}/datasources` already exists.
- No changes to views other than `UnifiedExploreView`, `MetricsExploreTab`, and `LogsExploreTab`.
- `TracesExploreTab` is out of scope (trace tools are a separate feature).

## Data Flow

```
User opens Cmd+K on Explore (Metrics tab)
  -> MetricsExploreTab emits datasource-changed({ id, name, type })
  -> UnifiedExploreView calls registerContext({ ..., datasourceId, datasourceName, datasourceType })
  -> CmdKModal reads currentContext.datasourceId
  -> CmdKChatView receives props.datasourceId
  -> Frontend prepends system message: "Working with datasource X..."
  -> Model calls get_metrics → executeTool uses props.datasourceId → backend returns metrics

User opens Cmd+K on Home (no datasource context)
  -> CmdKModal falls back to datasourceId = ''
  -> Frontend prepends system message: "No datasource selected, call list_datasources..."
  -> Model calls list_datasources → returns [{ id, name, type }, ...]
  -> Model calls get_metrics({ datasource_id: "<chosen-id>" }) → works
```

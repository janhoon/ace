# Cmd+K Datasource Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "invalid datasource id" error in Cmd+K chat tools and add full metrics/logs/traces tool support with datasource discovery.

**Architecture:** Explore tabs emit their selected datasource to the parent view, which registers it in the command context. The chat panel reads context to select type-appropriate tools and pass datasource IDs. A `list_datasources` tool enables discovery when no context exists. Backend system prompts are updated to mention available tools per datasource type.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Go (backend system prompts only)

**Spec:** `docs/superpowers/specs/2026-03-23-cmdk-datasource-tools-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/composables/useCopilotTools.ts` | Modify | Tool definitions (type-aware), executor (list_datasources, dsId override, trace services, type-aware navigation) |
| `frontend/src/composables/useCopilotTools.spec.ts` | Modify | Unit tests for tool definitions and executor |
| `frontend/src/components/CmdKChatView.vue` | Modify | Pass orgId to executor, system message, type-aware tool selection, track discovered dsId for generate_dashboard |
| `frontend/src/components/CmdKChatView.spec.ts` | Modify | Tests for system message, tool set selection |
| `frontend/src/components/CmdKModal.vue` | Modify | Fix no-context defaults (empty type/name instead of victoriametrics/default) |
| `frontend/src/components/CmdKModal.spec.ts` | Modify | Test no-context defaults |
| `frontend/src/views/UnifiedExploreView.vue` | Modify | Listen for datasource-changed, re-register context |
| `frontend/src/views/MetricsExploreTab.vue` | Modify | Emit datasource-changed on auto-select and user selection |
| `frontend/src/views/LogsExploreTab.vue` | Modify | Emit datasource-changed on auto-select and user selection |
| `frontend/src/views/TracesExploreTab.vue` | Modify | Emit datasource-changed on auto-select and user selection |
| `frontend/src/components/CmdKChatView.integration.spec.ts` | Create | Integration tests (real executor, mocked HTTP) |
| `backend/internal/handlers/github_copilot.go` | Modify | Update system prompts to mention tools per type |

---

### Task 1: Tool Definitions — list_datasources, datasource_id override, get_trace_services

**Files:**
- Modify: `frontend/src/composables/useCopilotTools.ts`
- Modify: `frontend/src/composables/useCopilotTools.spec.ts`

- [ ] **Step 1: Write failing tests for new tool definitions**

Add to `useCopilotTools.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getToolsForDatasourceType } from './useCopilotTools'

describe('getToolsForDatasourceType', () => {
  it('includes list_datasources for all types', () => {
    for (const type of ['victoriametrics', 'prometheus', 'loki', 'victorialogs', 'tempo', '']) {
      const tools = getToolsForDatasourceType(type)
      expect(tools.find((t) => t.function.name === 'list_datasources')).toBeDefined()
    }
  })

  it('includes get_metrics for metrics datasource types', () => {
    for (const type of ['victoriametrics', 'prometheus']) {
      const tools = getToolsForDatasourceType(type)
      expect(tools.find((t) => t.function.name === 'get_metrics')).toBeDefined()
    }
  })

  it('excludes get_metrics for logs datasource types', () => {
    for (const type of ['loki', 'victorialogs']) {
      const tools = getToolsForDatasourceType(type)
      expect(tools.find((t) => t.function.name === 'get_metrics')).toBeUndefined()
    }
  })

  it('includes get_trace_services for trace datasource types', () => {
    for (const type of ['tempo', 'victoriatraces']) {
      const tools = getToolsForDatasourceType(type)
      expect(tools.find((t) => t.function.name === 'get_trace_services')).toBeDefined()
    }
  })

  it('includes generate_dashboard only for metrics types', () => {
    const metricsTools = getToolsForDatasourceType('victoriametrics')
    expect(metricsTools.find((t) => t.function.name === 'generate_dashboard')).toBeDefined()

    const logsTools = getToolsForDatasourceType('loki')
    expect(logsTools.find((t) => t.function.name === 'generate_dashboard')).toBeUndefined()
  })

  it('includes all tool types when datasource type is empty', () => {
    const tools = getToolsForDatasourceType('')
    const names = tools.map((t) => t.function.name)
    expect(names).toContain('list_datasources')
    expect(names).toContain('get_metrics')
    expect(names).toContain('get_labels')
    expect(names).toContain('get_label_values')
    expect(names).toContain('get_trace_services')
    expect(names).toContain('write_query')
    expect(names).toContain('run_query')
    expect(names).toContain('generate_dashboard')
  })

  it('get_metrics has optional datasource_id parameter', () => {
    const tools = getToolsForDatasourceType('victoriametrics')
    const getMetrics = tools.find((t) => t.function.name === 'get_metrics')
    const props = getMetrics!.function.parameters as { properties?: Record<string, unknown> }
    expect(props.properties).toHaveProperty('datasource_id')
  })

  it('get_labels has optional datasource_id parameter', () => {
    const tools = getToolsForDatasourceType('victoriametrics')
    const getLabels = tools.find((t) => t.function.name === 'get_labels')
    const props = getLabels!.function.parameters as { properties?: Record<string, unknown> }
    expect(props.properties).toHaveProperty('datasource_id')
  })

  it('get_label_values has optional datasource_id parameter', () => {
    const tools = getToolsForDatasourceType('victoriametrics')
    const getLabelValues = tools.find((t) => t.function.name === 'get_label_values')
    const props = getLabelValues!.function.parameters as { properties?: Record<string, unknown> }
    expect(props.properties).toHaveProperty('datasource_id')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/composables/useCopilotTools.spec.ts`
Expected: FAIL — `getToolsForDatasourceType` not exported

- [ ] **Step 3: Implement getToolsForDatasourceType**

In `useCopilotTools.ts`, add the `list_datasources` and `get_trace_services` tool definitions, add `datasource_id` to discovery tools, and create the type-aware function. Keep `getMetricsTools()` as an alias for backward compatibility until CmdKChatView is updated.

```ts
// Add to tool definition objects inside a new function:

const listDatasourcesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_datasources',
    description:
      'List all datasources available in the current organization. Use this to discover datasource IDs before querying metrics or labels.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
}

const getTraceServicesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_trace_services',
    description:
      'List service names from a tracing datasource. Use this to discover what services are reporting traces.',
    parameters: {
      type: 'object',
      properties: {
        datasource_id: {
          type: 'string',
          description: 'Override the default datasource. Use an ID from list_datasources.',
        },
      },
    },
  },
}

// Add datasource_id property to get_metrics, get_labels, get_label_values:
// datasource_id: {
//   type: 'string',
//   description: 'Override the default datasource. Use an ID from list_datasources.',
// },

const METRICS_TYPES = new Set(['victoriametrics', 'prometheus'])
const LOGS_TYPES = new Set(['loki', 'victorialogs'])
const TRACES_TYPES = new Set(['tempo', 'victoriatraces'])

export function getToolsForDatasourceType(datasourceType: string): ToolDefinition[] {
  const tools: ToolDefinition[] = [listDatasourcesTool]

  const isMetrics = METRICS_TYPES.has(datasourceType)
  const isLogs = LOGS_TYPES.has(datasourceType)
  const isTraces = TRACES_TYPES.has(datasourceType)
  const isUnknown = !isMetrics && !isLogs && !isTraces

  // Discovery tools
  if (isMetrics || isUnknown) tools.push(getMetricsTool)
  tools.push(getLabelsTool, getLabelValuesTool)
  if (isTraces || isUnknown) tools.push(getTraceServicesTool)

  // Query tools
  tools.push(writeQueryTool, runQueryTool)

  // Dashboard generation (metrics only, or unknown)
  if (isMetrics || isUnknown) tools.push(generateDashboardTool)

  return tools
}
```

Refactor the existing tool definitions from the inline array into named constants (e.g. `getMetricsTool`, `getLabelsTool`, etc.) so they can be composed. Keep `getMetricsTools()` calling `getToolsForDatasourceType('victoriametrics')` for backward compat.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/composables/useCopilotTools.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useCopilotTools.ts frontend/src/composables/useCopilotTools.spec.ts
git commit -m "feat: add type-aware tool sets with list_datasources and get_trace_services"
```

---

### Task 2: Tool Executor — list_datasources, dsId override, trace services, type-aware navigation

**Files:**
- Modify: `frontend/src/composables/useCopilotTools.ts`
- Modify: `frontend/src/composables/useCopilotTools.spec.ts`

- [ ] **Step 1: Write failing tests for executor changes**

Add to `useCopilotTools.spec.ts`:

```ts
import { vi } from 'vitest'
import type { ToolCall } from './useCopilot'

// Mock the API modules
vi.mock('../api/datasources', () => ({
  fetchDataSourceMetricNames: vi.fn(),
  fetchDataSourceLabels: vi.fn(),
  fetchDataSourceLabelValues: vi.fn(),
  fetchDataSourceTraceServices: vi.fn(),
  listDataSources: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('./useQueryEditor', () => ({
  useQueryEditor: () => ({
    hasEditor: () => false,
    setQuery: vi.fn(),
    execute: vi.fn(),
  }),
}))

import {
  fetchDataSourceLabels,
  fetchDataSourceLabelValues,
  fetchDataSourceMetricNames,
  fetchDataSourceTraceServices,
  listDataSources,
} from '../api/datasources'
import { useCopilotToolExecutor } from './useCopilotTools'

function makeToolCall(name: string, args: Record<string, unknown> = {}): ToolCall {
  return {
    id: 'tc-1',
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  }
}

describe('useCopilotToolExecutor', () => {
  const mockDsId = () => 'ds-default'
  const mockOrgId = () => 'org-1'
  const mockDsType = () => 'victoriametrics'

  it('list_datasources returns datasource list as JSON', async () => {
    vi.mocked(listDataSources).mockResolvedValue([
      { id: 'ds-1', name: 'Prom', type: 'prometheus' } as any,
    ])
    const { executeTool } = useCopilotToolExecutor(mockDsId, mockOrgId, mockDsType)
    const result = await executeTool(makeToolCall('list_datasources'))
    expect(result).toContain('ds-1')
    expect(result).toContain('Prom')
    expect(listDataSources).toHaveBeenCalledWith('org-1')
  })

  it('list_datasources returns error when orgId is empty', async () => {
    const { executeTool } = useCopilotToolExecutor(mockDsId, () => '', mockDsType)
    const result = await executeTool(makeToolCall('list_datasources'))
    expect(result).toContain('Error')
    expect(result).toContain('no organization')
  })

  it('get_metrics uses override datasource_id when provided', async () => {
    vi.mocked(fetchDataSourceMetricNames).mockResolvedValue(['up', 'http_requests_total'])
    const { executeTool } = useCopilotToolExecutor(mockDsId, mockOrgId, mockDsType)
    await executeTool(makeToolCall('get_metrics', { datasource_id: 'ds-override' }))
    expect(fetchDataSourceMetricNames).toHaveBeenCalledWith('ds-override', undefined)
  })

  it('get_metrics falls back to context datasource_id', async () => {
    vi.mocked(fetchDataSourceMetricNames).mockResolvedValue(['up'])
    const { executeTool } = useCopilotToolExecutor(mockDsId, mockOrgId, mockDsType)
    await executeTool(makeToolCall('get_metrics'))
    expect(fetchDataSourceMetricNames).toHaveBeenCalledWith('ds-default', undefined)
  })

  it('get_metrics returns error when no datasource available', async () => {
    const { executeTool } = useCopilotToolExecutor(() => '', mockOrgId, mockDsType)
    const result = await executeTool(makeToolCall('get_metrics'))
    expect(result).toContain('Error')
    expect(result).toContain('no datasource')
  })

  it('get_labels uses override datasource_id', async () => {
    vi.mocked(fetchDataSourceLabels).mockResolvedValue(['job', 'instance'])
    const { executeTool } = useCopilotToolExecutor(mockDsId, mockOrgId, mockDsType)
    await executeTool(makeToolCall('get_labels', { datasource_id: 'ds-2' }))
    expect(fetchDataSourceLabels).toHaveBeenCalledWith('ds-2', undefined)
  })

  it('get_label_values uses override datasource_id', async () => {
    vi.mocked(fetchDataSourceLabelValues).mockResolvedValue(['node1', 'node2'])
    const { executeTool } = useCopilotToolExecutor(mockDsId, mockOrgId, mockDsType)
    await executeTool(makeToolCall('get_label_values', { label: 'instance', datasource_id: 'ds-3' }))
    expect(fetchDataSourceLabelValues).toHaveBeenCalledWith('ds-3', 'instance', undefined)
  })

  it('get_trace_services returns services list', async () => {
    vi.mocked(fetchDataSourceTraceServices).mockResolvedValue(['frontend', 'api', 'db'])
    const { executeTool } = useCopilotToolExecutor(mockDsId, mockOrgId, mockDsType)
    const result = await executeTool(makeToolCall('get_trace_services'))
    expect(result).toContain('frontend')
    expect(result).toContain('api')
    expect(fetchDataSourceTraceServices).toHaveBeenCalledWith('ds-default')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/composables/useCopilotTools.spec.ts`
Expected: FAIL — signature mismatch, missing cases

- [ ] **Step 3: Implement executor changes**

In `useCopilotTools.ts`:

1. Change signature: `export function useCopilotToolExecutor(datasourceId: () => string, orgId: () => string, datasourceType: () => string)`

2. Add helper:
```ts
function resolveDatasourceId(args: Record<string, unknown>, defaultId: string): string | null {
  const id = (args.datasource_id as string) || defaultId
  return id || null
}
```

3. Add `list_datasources` case:
```ts
case 'list_datasources': {
  const org = orgId()
  if (!org) return 'Error: no organization selected'
  const sources = await listDataSources(org)
  return JSON.stringify(sources.map((ds) => ({ id: ds.id, name: ds.name, type: ds.type })))
}
```

4. Update `get_metrics`, `get_labels`, `get_label_values` to use `resolveDatasourceId`:
```ts
case 'get_metrics': {
  const dsId = resolveDatasourceId(args, datasourceId())
  if (!dsId) return 'Error: no datasource selected. Call list_datasources first to get a datasource ID.'
  // ... existing logic with dsId
}
```

5. Add `get_trace_services` case:
```ts
case 'get_trace_services': {
  const dsId = resolveDatasourceId(args, datasourceId())
  if (!dsId) return 'Error: no datasource selected. Call list_datasources first to get a datasource ID.'
  const services = await fetchDataSourceTraceServices(dsId)
  if (services.length === 0) return 'No services found'
  return services.join('\n')
}
```

6. Update `write_query` to navigate based on datasource type:
```ts
case 'write_query': {
  if (!args.query) return 'Error: query parameter is required'
  if (queryEditor.hasEditor()) {
    queryEditor.setQuery(args.query as string)
    return `Query written to editor: ${args.query}`
  }
  const dsType = datasourceType()
  let route = '/app/explore/metrics'
  if (['loki', 'victorialogs'].includes(dsType)) route = '/app/explore/logs'
  else if (['tempo', 'victoriatraces'].includes(dsType)) route = '/app/explore/traces'
  await router.push(route)
  // ... rest stays the same
}
```

7. Add imports for `listDataSources` and `fetchDataSourceTraceServices`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/composables/useCopilotTools.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useCopilotTools.ts frontend/src/composables/useCopilotTools.spec.ts
git commit -m "feat: executor with list_datasources, dsId override, trace services, type-aware nav"
```

---

### Task 3: CmdKChatView — system message, type-aware tools, track discovered dsId

**Files:**
- Modify: `frontend/src/components/CmdKChatView.vue`
- Modify: `frontend/src/components/CmdKChatView.spec.ts`

- [ ] **Step 1: Write failing tests**

Add to `CmdKChatView.spec.ts`. Update the mock for `useCopilotToolExecutor` to match new signature. Add tests:

```ts
// Update mock to match new 3-param signature:
vi.mock('../composables/useCopilotTools', () => ({
  getToolsForDatasourceType: vi.fn().mockReturnValue([]),
  getMetricsTools: () => [],
  useCopilotToolExecutor: () => ({
    executeTool: mockExecuteTool,
  }),
}))

// Add useOrganization mock:
vi.mock('../composables/useOrganization', () => ({
  useOrganization: () => ({
    currentOrg: ref({ id: 'org-1', name: 'Test Org' }),
  }),
}))

// Test: system message with datasource context
it('prepends system message with datasource info when datasourceId is set', async () => {
  wrapper = createWrapper()
  await flushPromises()

  const call = mockSendChatRequest.mock.calls[0]!
  const messages = call[2] as Array<{ role: string; content: string }>
  const systemMsg = messages.find((m) => m.role === 'system')
  expect(systemMsg).toBeDefined()
  expect(systemMsg!.content).toContain('ds-1')
  expect(systemMsg!.content).toContain('VictoriaMetrics')
})

// Test: system message without datasource context
it('prepends system message instructing list_datasources when datasourceId is empty', async () => {
  wrapper = createWrapper({
    ...defaultProps,
    datasourceId: '',
    datasourceType: '',
    datasourceName: '',
  })
  await flushPromises()

  const call = mockSendChatRequest.mock.calls[0]!
  const messages = call[2] as Array<{ role: string; content: string }>
  const systemMsg = messages.find((m) => m.role === 'system')
  expect(systemMsg).toBeDefined()
  expect(systemMsg!.content).toContain('list_datasources')
})

// Test: calls getToolsForDatasourceType with correct type
it('uses type-aware tool set based on datasourceType prop', async () => {
  const { getToolsForDatasourceType } = await import('../composables/useCopilotTools')
  wrapper = createWrapper()
  await flushPromises()

  expect(getToolsForDatasourceType).toHaveBeenCalledWith('victoriametrics')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/CmdKChatView.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement CmdKChatView changes**

In `CmdKChatView.vue`:

1. Import `useOrganization` and `getToolsForDatasourceType`:
```ts
import { useOrganization } from '../composables/useOrganization'
import { getToolsForDatasourceType, useCopilotToolExecutor } from '../composables/useCopilotTools'
```

2. Get orgId:
```ts
const { currentOrg } = useOrganization()
```

3. Update executor call (3 params):
```ts
const { executeTool } = useCopilotToolExecutor(
  () => props.datasourceId,
  () => currentOrg.value?.id ?? '',
  () => props.datasourceType,
)
```

4. Track last used datasource_id for generate_dashboard:
```ts
const lastUsedDatasourceId = ref('')
```

5. Update `buildChatRequestMessages()` to prepend system message:
```ts
function buildChatRequestMessages(): ChatRequestMessage[] {
  const messages: ChatRequestMessage[] = []

  if (props.datasourceId) {
    messages.push({
      role: 'system',
      content: `You have tools to explore datasource data. You are currently working with datasource '${props.datasourceName}' (type: ${props.datasourceType}, id: ${props.datasourceId}). You can use the data discovery tools directly.`,
    })
  } else {
    messages.push({
      role: 'system',
      content: 'You have tools to explore datasource data. No datasource is currently selected. Call list_datasources first to discover available datasources, then pass the datasource_id to other tools.',
    })
  }

  messages.push(...chatMessages.value.map((m) => ({ role: m.role, content: m.content })))
  return messages
}
```

6. Replace `getMetricsTools()` with `getToolsForDatasourceType(props.datasourceType)`:
```ts
const tools = getToolsForDatasourceType(props.datasourceType)
```

7. Track datasource_id from tool calls and use it for generate_dashboard:
```ts
// Inside the tool call loop, after executeTool:
if (args.datasource_id) {
  lastUsedDatasourceId.value = args.datasource_id as string
}

// In the generate_dashboard handler:
spec.panels?.forEach((p) => {
  if (p.query) p.query.datasource_id = props.datasourceId || lastUsedDatasourceId.value
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/CmdKChatView.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CmdKChatView.vue frontend/src/components/CmdKChatView.spec.ts
git commit -m "feat: CmdKChatView with system message, type-aware tools, discovered dsId tracking"
```

---

### Task 4: CmdKModal — fix no-context defaults

**Files:**
- Modify: `frontend/src/components/CmdKModal.vue:156-158`
- Modify: `frontend/src/components/CmdKModal.spec.ts`

- [ ] **Step 1: Write failing test**

Add to `CmdKModal.spec.ts`:

```ts
it('passes empty datasourceType and datasourceName when no context', async () => {
  mockContext.value = null
  wrapper = createWrapper({ isOpen: true })
  await flushPromises()

  // Enter chat mode
  // ... trigger handleEnterChat

  const chatView = wrapper.findComponent({ name: 'CmdKChatView' })
  if (chatView.exists()) {
    expect(chatView.props('datasourceType')).toBe('')
    expect(chatView.props('datasourceName')).toBe('')
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/CmdKModal.spec.ts`
Expected: FAIL — currently defaults to `'victoriametrics'` and `'default'`

- [ ] **Step 3: Implement fix**

In `CmdKModal.vue`, change lines 156-158:

```vue
<!-- Before -->
:datasource-type="currentContext?.datasourceType ?? 'victoriametrics'"
:datasource-name="currentContext?.datasourceName ?? 'default'"
:datasource-id="currentContext?.datasourceId ?? ''"

<!-- After -->
:datasource-type="currentContext?.datasourceType ?? ''"
:datasource-name="currentContext?.datasourceName ?? ''"
:datasource-id="currentContext?.datasourceId ?? ''"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/CmdKModal.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CmdKModal.vue frontend/src/components/CmdKModal.spec.ts
git commit -m "fix: pass empty datasource defaults when no context in CmdKModal"
```

---

### Task 5: Context Propagation — Explore tabs emit datasource-changed

**Files:**
- Modify: `frontend/src/views/MetricsExploreTab.vue`
- Modify: `frontend/src/views/LogsExploreTab.vue`
- Modify: `frontend/src/views/TracesExploreTab.vue`
- Modify: `frontend/src/views/UnifiedExploreView.vue`

- [ ] **Step 1: Add emit to MetricsExploreTab**

Add emit definition:
```ts
const emit = defineEmits<{
  'datasource-changed': [payload: { id: string; name: string; type: string }]
}>()
```

Add watcher on `selectedDatasourceId` to emit:
```ts
watch(selectedDatasourceId, (newId) => {
  const ds = metricsDatasources.value.find((d) => d.id === newId)
  if (ds) {
    emit('datasource-changed', { id: ds.id, name: ds.name, type: ds.type })
  }
})
```

This fires on both auto-select (the existing watcher sets `selectedDatasourceId`, which triggers this) and user selection.

- [ ] **Step 2: Add emit to LogsExploreTab**

Same pattern as MetricsExploreTab but using `logsDatasources`:

```ts
const emit = defineEmits<{
  'datasource-changed': [payload: { id: string; name: string; type: string }]
}>()

watch(selectedDatasourceId, (newId) => {
  const ds = logsDatasources.value.find((d) => d.id === newId)
  if (ds) {
    emit('datasource-changed', { id: ds.id, name: ds.name, type: ds.type })
  }
})
```

- [ ] **Step 3: Add emit to TracesExploreTab**

Same pattern but using `tracingDatasources`:

```ts
const emit = defineEmits<{
  'datasource-changed': [payload: { id: string; name: string; type: string }]
}>()

watch(selectedDatasourceId, (newId) => {
  const ds = tracingDatasources.value.find((d) => d.id === newId)
  if (ds) {
    emit('datasource-changed', { id: ds.id, name: ds.name, type: ds.type })
  }
})
```

- [ ] **Step 4: Update UnifiedExploreView to listen and re-register context**

```ts
// Add to script setup:
function handleDatasourceChanged(payload: { id: string; name: string; type: string }) {
  registerContext({
    viewName: 'Explore',
    viewRoute: '/app/explore',
    description: 'Query and visualize metrics, logs, and traces from connected datasources',
    datasourceId: payload.id,
    datasourceName: payload.name,
    datasourceType: payload.type,
  })
}
```

Update template — add event listener on the dynamic component:
```vue
<component :is="activeComponent" :key="activeType" @datasource-changed="handleDatasourceChanged" />
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/MetricsExploreTab.vue frontend/src/views/LogsExploreTab.vue frontend/src/views/TracesExploreTab.vue frontend/src/views/UnifiedExploreView.vue
git commit -m "feat: Explore tabs emit datasource-changed, UnifiedExploreView propagates to context"
```

---

### Task 6: Backend System Prompts — add tool guidance per datasource type

**Files:**
- Modify: `backend/internal/handlers/github_copilot.go:120-193`

- [ ] **Step 1: Update system prompts**

Add tool usage instructions to each relevant prompt. Append to the end of each string:

**loki:**
```
When you have tools available, use them:
1. Use get_labels to discover available label names
2. Use get_label_values to understand label dimensions
3. Use write_query to write a LogQL query for the user to review`
```

**victorialogs:** Same pattern as loki but mention VictoriaLogs syntax.

**prometheus:**
```
When you have tools available, use them:
1. Use get_metrics to discover available metric names
2. Use get_labels and get_label_values to understand dimensions
3. Use write_query to write a PromQL query, or generate_dashboard for a dashboard`
```

**tempo:**
```
When you have tools available, use them:
1. Use get_trace_services to discover services reporting traces
2. Use get_labels and get_label_values to understand trace attributes
3. Use write_query to write a TraceQL query for the user`
```

**victoriatraces:** Same pattern as tempo.

- [ ] **Step 2: Commit**

```bash
git add backend/internal/handlers/github_copilot.go
git commit -m "feat: add tool usage guidance to backend system prompts for all datasource types"
```

---

### Task 7: Integration Tests

**Files:**
- Create: `frontend/src/components/CmdKChatView.integration.spec.ts`

- [ ] **Step 1: Write integration tests**

These use the real `useCopilotToolExecutor` (unmocked) with mocked HTTP layer:

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// Mock HTTP layer (api/datasources), NOT the composables
vi.mock('../api/datasources', () => ({
  fetchDataSourceMetricNames: vi.fn().mockResolvedValue(['up', 'http_requests_total']),
  fetchDataSourceLabels: vi.fn().mockResolvedValue(['job', 'instance']),
  fetchDataSourceLabelValues: vi.fn().mockResolvedValue(['node1']),
  fetchDataSourceTraceServices: vi.fn().mockResolvedValue(['frontend', 'api']),
  listDataSources: vi.fn().mockResolvedValue([
    { id: 'ds-1', name: 'Prometheus', type: 'prometheus', organization_id: 'org-1', url: '', is_default: true, auth_type: 'none', trace_id_field: '', created_at: '', updated_at: '' },
    { id: 'ds-2', name: 'Loki', type: 'loki', organization_id: 'org-1', url: '', is_default: false, auth_type: 'none', trace_id_field: '', created_at: '', updated_at: '' },
  ]),
}))

vi.mock('../composables/useOrganization', () => ({
  useOrganization: () => ({ currentOrg: ref({ id: 'org-1', name: 'Test' }) }),
}))

const mockSendChatRequest = vi.fn()
vi.mock('../composables/useCopilot', () => ({
  useCopilot: () => ({
    sendChatRequest: mockSendChatRequest,
    chatMessages: ref([]),
    models: ref([]),
    selectedModel: ref(''),
    fetchModels: vi.fn(),
    isLoading: ref(false),
    error: ref(null),
  }),
}))

vi.mock('../utils/markdown', () => ({
  initMarkdown: vi.fn().mockResolvedValue(undefined),
  renderMarkdown: vi.fn().mockResolvedValue('<p>test</p>'),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { fetchDataSourceMetricNames, fetchDataSourceLabels, listDataSources } from '../api/datasources'
import CmdKChatView from './CmdKChatView.vue'

describe('CmdKChatView integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendChatRequest.mockResolvedValue({ content: 'Done', toolCalls: [] })
  })

  it('metrics context: get_metrics tool call uses context datasource ID', async () => {
    // Simulate model returning a get_metrics tool call
    mockSendChatRequest
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'get_metrics', arguments: '{}' } }],
      })
      .mockResolvedValueOnce({ content: 'Found metrics: up', toolCalls: [] })

    mount(CmdKChatView, {
      props: {
        initialQuery: 'show metrics',
        datasourceType: 'victoriametrics',
        datasourceName: 'VM',
        datasourceId: 'ds-vm',
      },
      global: { stubs: { DashboardSpecPreview: true } },
    })
    await flushPromises()

    expect(fetchDataSourceMetricNames).toHaveBeenCalledWith('ds-vm', undefined)
  })

  it('logs context: get_labels tool call uses context datasource ID', async () => {
    mockSendChatRequest
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'get_labels', arguments: '{}' } }],
      })
      .mockResolvedValueOnce({ content: 'Found labels', toolCalls: [] })

    mount(CmdKChatView, {
      props: {
        initialQuery: 'show labels',
        datasourceType: 'loki',
        datasourceName: 'Loki',
        datasourceId: 'ds-loki',
      },
      global: { stubs: { DashboardSpecPreview: true } },
    })
    await flushPromises()

    expect(fetchDataSourceLabels).toHaveBeenCalledWith('ds-loki', undefined)
  })

  it('no context: list_datasources then override works', async () => {
    mockSendChatRequest
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'list_datasources', arguments: '{}' } }],
      })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{ id: 'tc-2', type: 'function', function: { name: 'get_metrics', arguments: '{"datasource_id":"ds-1"}' } }],
      })
      .mockResolvedValueOnce({ content: 'Here are your metrics', toolCalls: [] })

    mount(CmdKChatView, {
      props: {
        initialQuery: 'show metrics',
        datasourceType: '',
        datasourceName: '',
        datasourceId: '',
      },
      global: { stubs: { DashboardSpecPreview: true } },
    })
    await flushPromises()

    expect(listDataSources).toHaveBeenCalledWith('org-1')
    expect(fetchDataSourceMetricNames).toHaveBeenCalledWith('ds-1', undefined)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx vitest run src/components/CmdKChatView.integration.spec.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CmdKChatView.integration.spec.ts
git commit -m "test: add integration tests for Cmd+K datasource tool chain"
```

---

### Task 8: Run Full Test Suite & Lint

- [ ] **Step 1: Run all tests**

Run: `cd frontend && npm run test`
Expected: All PASS

- [ ] **Step 2: Run linter**

Run: `cd frontend && npm run lint:fix`
Expected: No errors (auto-fixes applied)

- [ ] **Step 3: Build check**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit if lint made changes**

```bash
git add -A && git diff --cached --quiet || git commit -m "chore: lint fixes"
```

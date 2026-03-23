# Copilot Device Flow + Cmd+K Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace admin GitHub OAuth form with per-user device flow in Settings, add dashboard search + Copilot AI chat to Cmd+K modal.

**Architecture:** Refactor `useCopilot` to shared module-level state. Create `CopilotConnectionPanel` for settings. Split Cmd+K into orchestrator (`CmdKModal`) + `CmdKSearchResults` + `CmdKChatView` subcomponents. All backend endpoints already exist — this is frontend-only.

**Tech Stack:** Vue 3 Composition API, Vitest + happy-dom, Tailwind + CSS custom properties (Kinetic design system)

**Spec:** `docs/superpowers/specs/2026-03-23-copilot-settings-cmdk-design.md`

---

### Task 1: Refactor `useCopilot` to shared module-level state

**Files:**
- Modify: `frontend/src/composables/useCopilot.ts`

Currently every call to `useCopilot()` creates independent `ref()` instances. Connection state (`isConnected`, `githubUsername`, `hasCopilot`, `models`, `selectedModel`) must be shared so the Settings panel and Cmd+K modal see the same values. Device flow state (`deviceFlowActive`, `userCode`, `verificationUri`) stays per-call since only one component uses it.

Follow the existing pattern from `useOrganization.ts` — module-level refs outside the function, returned by reference.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/composables/useCopilot.spec.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('useCopilot shared state', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shares isConnected across multiple calls', async () => {
    const { useCopilot } = await import('./useCopilot')
    const a = useCopilot()
    const b = useCopilot()
    a.isConnected.value = true
    expect(b.isConnected.value).toBe(true)
  })

  it('shares githubUsername across multiple calls', async () => {
    const { useCopilot } = await import('./useCopilot')
    const a = useCopilot()
    const b = useCopilot()
    a.githubUsername.value = 'testuser'
    expect(b.githubUsername.value).toBe('testuser')
  })

  it('shares hasCopilot across multiple calls', async () => {
    const { useCopilot } = await import('./useCopilot')
    const a = useCopilot()
    const b = useCopilot()
    a.hasCopilot.value = true
    expect(b.hasCopilot.value).toBe(true)
  })

  it('shares chatMessages across multiple calls (persistent chat)', async () => {
    const { useCopilot } = await import('./useCopilot')
    const a = useCopilot()
    const b = useCopilot()
    a.chatMessages.value = [{ role: 'user', content: 'hello' }]
    expect(b.chatMessages.value).toHaveLength(1)
  })

  it('does NOT share deviceFlowActive across calls', async () => {
    const { useCopilot } = await import('./useCopilot')
    const a = useCopilot()
    const b = useCopilot()
    a.deviceFlowActive.value = true
    expect(b.deviceFlowActive.value).toBe(false)
  })

  it('shares models across multiple calls', async () => {
    const { useCopilot } = await import('./useCopilot')
    const a = useCopilot()
    const b = useCopilot()
    a.models.value = [{ id: 'test', name: 'Test', vendor: 'v', category: 'c', preview: false, premium_multiplier: 1 }]
    expect(b.models.value).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/composables/useCopilot.spec.ts`
Expected: FAIL — `isConnected` is not shared (independent refs).

- [ ] **Step 3: Refactor useCopilot to module-level shared state**

In `frontend/src/composables/useCopilot.ts`, move the shared refs outside the function:

```ts
// Module-level shared state (like useOrganization pattern)
const isConnected = ref(false)
const githubUsername = ref('')
const hasCopilot = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const models = ref<CopilotModel[]>([])
const selectedModel = ref<string>('')
const chatMessages = ref<CopilotMessage[]>([])

export function useCopilot() {
  // Per-instance state (only used by settings panel)
  const deviceFlowActive = ref(false)
  const userCode = ref('')
  const verificationUri = ref('')

  // ... all functions stay the same, they reference the module-level refs ...

  return {
    isConnected,
    githubUsername,
    hasCopilot,
    isLoading,
    error,
    models,
    selectedModel,
    deviceFlowActive,
    userCode,
    verificationUri,
    checkConnection,
    fetchModels,
    connect,
    cancelDeviceFlow,
    disconnect,
    sendMessage,
    chatMessages,
    sendChatRequest,
  }
}
```

The `chatMessages` ref is module-level so chat history persists across modal opens/closes (per spec decision #5). `CmdKChatView` reads/writes this ref instead of local state.

The functions (`checkConnection`, `connect`, `disconnect`, `fetchModels`, `sendMessage`, `sendChatRequest`) all stay inside the function body — they close over the module-level refs which works correctly.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/composables/useCopilot.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useCopilot.ts frontend/src/composables/useCopilot.spec.ts
git commit -m "refactor: make useCopilot connection state shared via module-level refs"
```

---

### Task 2: Rename `getVictoriaMetricsTools` to `getMetricsTools` and accept Prometheus

**Files:**
- Modify: `frontend/src/composables/useCopilotTools.ts`
- Modify: `frontend/src/composables/useCopilotTools.spec.ts`

- [ ] **Step 1: Update tests to use new name**

In `frontend/src/composables/useCopilotTools.spec.ts`, replace all `getVictoriaMetricsTools` with `getMetricsTools`:

```ts
import { getMetricsTools } from './useCopilotTools'

describe('getMetricsTools', () => {
  it('includes a generate_dashboard tool definition', () => {
    const tools = getMetricsTools()
    // ... same assertions
  })
  // ... update all other references
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/composables/useCopilotTools.spec.ts`
Expected: FAIL — `getMetricsTools` is not exported.

- [ ] **Step 3: Rename the function**

In `frontend/src/composables/useCopilotTools.ts`, rename:

```ts
export function getMetricsTools(): ToolDefinition[] {
  // same body
}
```

The tools are datasource-agnostic (get_metrics, get_labels, get_label_values work on both VictoriaMetrics and Prometheus via the same backend API). The rename reflects this — no parameter needed since the tool definitions are identical for both types. The gate that previously restricted tools to VictoriaMetrics only was in the deleted `CopilotPanel.vue` — it no longer exists.

Also export the old name for backwards compat during transition (in case anything else imports it):

```ts
export const getVictoriaMetricsTools = getMetricsTools
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/composables/useCopilotTools.spec.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite to check nothing broke**

Run: `cd frontend && npx vitest run`
Expected: All pass (old name still exported as alias).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/composables/useCopilotTools.ts frontend/src/composables/useCopilotTools.spec.ts
git commit -m "refactor: rename getVictoriaMetricsTools to getMetricsTools"
```

---

### Task 3: Create `CopilotConnectionPanel` component

**Files:**
- Create: `frontend/src/components/CopilotConnectionPanel.vue`
- Create: `frontend/src/components/CopilotConnectionPanel.spec.ts`

This component replaces `GitHubAppSettings.vue` in Settings > AI Configuration. It shows device flow authentication UI for all users (no admin gate).

**Reference for design tokens:** `DESIGN.md` and `frontend/src/style.css`. Use Kinetic palette: `--color-primary` for badges, `--color-surface-container-low` for card bg, `--color-on-surface` for text.

**Reference for state machine:** The deleted `CopilotPanel.vue` had similar states — view it with `git show 3111b77^:frontend/src/components/CopilotPanel.vue` for patterns.

- [ ] **Step 1: Write failing tests for all states**

Create `frontend/src/components/CopilotConnectionPanel.spec.ts`:

```ts
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import CopilotConnectionPanel from './CopilotConnectionPanel.vue'

const mockIsConnected = ref(false)
const mockGithubUsername = ref('')
const mockHasCopilot = ref(false)
const mockError = ref<string | null>(null)
const mockDeviceFlowActive = ref(false)
const mockUserCode = ref('')
const mockVerificationUri = ref('')
const mockCheckConnection = vi.fn()
const mockConnect = vi.fn()
const mockCancelDeviceFlow = vi.fn()
const mockDisconnect = vi.fn()

vi.mock('../composables/useCopilot', () => ({
  useCopilot: () => ({
    isConnected: mockIsConnected,
    githubUsername: mockGithubUsername,
    hasCopilot: mockHasCopilot,
    error: mockError,
    deviceFlowActive: mockDeviceFlowActive,
    userCode: mockUserCode,
    verificationUri: mockVerificationUri,
    checkConnection: mockCheckConnection,
    connect: mockConnect,
    cancelDeviceFlow: mockCancelDeviceFlow,
    disconnect: mockDisconnect,
  }),
}))

describe('CopilotConnectionPanel', () => {
  let wrapper: VueWrapper

  function createWrapper() {
    return mount(CopilotConnectionPanel, {
      props: { orgId: 'org-123' },
      global: {
        stubs: {
          Github: { template: '<span class="icon-github" />' },
          Loader2: { template: '<span class="icon-loader" />' },
          ClipboardCopy: { template: '<span class="icon-copy" />' },
          ExternalLink: { template: '<span class="icon-external" />' },
          Unplug: { template: '<span class="icon-unplug" />' },
          Check: { template: '<span class="icon-check" />' },
          AlertTriangle: { template: '<span class="icon-alert" />' },
        },
      },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsConnected.value = false
    mockGithubUsername.value = ''
    mockHasCopilot.value = false
    mockError.value = null
    mockDeviceFlowActive.value = false
    mockUserCode.value = ''
    mockVerificationUri.value = ''
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('calls checkConnection on mount', () => {
    wrapper = createWrapper()
    expect(mockCheckConnection).toHaveBeenCalledOnce()
  })

  it('shows connect button when not connected', () => {
    wrapper = createWrapper()
    expect(wrapper.find('[data-testid="copilot-connect-btn"]').exists()).toBe(true)
  })

  it('shows device flow UI when device flow is active', async () => {
    mockDeviceFlowActive.value = true
    mockUserCode.value = 'ABCD-1234'
    mockVerificationUri.value = 'https://github.com/login/device'
    wrapper = createWrapper()
    expect(wrapper.find('[data-testid="copilot-user-code"]').text()).toContain('ABCD-1234')
    expect(wrapper.find('[data-testid="copilot-open-github-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="copilot-cancel-btn"]').exists()).toBe(true)
  })

  it('shows connected state with username and badge when has copilot', () => {
    mockIsConnected.value = true
    mockGithubUsername.value = 'octocat'
    mockHasCopilot.value = true
    wrapper = createWrapper()
    expect(wrapper.text()).toContain('octocat')
    expect(wrapper.find('[data-testid="copilot-active-badge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="copilot-disconnect-btn"]').exists()).toBe(true)
  })

  it('shows warning when connected but no copilot subscription', () => {
    mockIsConnected.value = true
    mockGithubUsername.value = 'octocat'
    mockHasCopilot.value = false
    wrapper = createWrapper()
    expect(wrapper.text()).toContain('octocat')
    expect(wrapper.text()).toContain('No active Copilot subscription')
  })

  it('shows error message when error exists', () => {
    mockError.value = 'Something went wrong'
    wrapper = createWrapper()
    expect(wrapper.text()).toContain('Something went wrong')
  })

  it('calls connect when connect button is clicked', async () => {
    wrapper = createWrapper()
    await wrapper.find('[data-testid="copilot-connect-btn"]').trigger('click')
    expect(mockConnect).toHaveBeenCalledWith('org-123')
  })

  it('calls disconnect when disconnect button is clicked', async () => {
    mockIsConnected.value = true
    mockHasCopilot.value = true
    mockGithubUsername.value = 'octocat'
    wrapper = createWrapper()
    await wrapper.find('[data-testid="copilot-disconnect-btn"]').trigger('click')
    expect(mockDisconnect).toHaveBeenCalledOnce()
  })

  it('calls cancelDeviceFlow when cancel button is clicked', async () => {
    mockDeviceFlowActive.value = true
    mockUserCode.value = 'ABCD-1234'
    mockVerificationUri.value = 'https://github.com/login/device'
    wrapper = createWrapper()
    await wrapper.find('[data-testid="copilot-cancel-btn"]').trigger('click')
    expect(mockCancelDeviceFlow).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/CopilotConnectionPanel.spec.ts`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement CopilotConnectionPanel.vue**

Create `frontend/src/components/CopilotConnectionPanel.vue`. The component uses `useCopilot()` for all state and actions. Follow Kinetic design tokens from DESIGN.md. Use `:style` bindings with `var(--color-*)` for colors, Tailwind for layout. Icon imports from `lucide-vue-next`.

States to render:
1. `deviceFlowActive` — show user code (large, monospace), "Open GitHub" link, cancel button, spinner
2. `!isConnected && !deviceFlowActive` — description text + "Connect GitHub Copilot" button
3. `isConnected && hasCopilot` — username + "Copilot Active" badge + disconnect
4. `isConnected && !hasCopilot` — username + warning + disconnect
5. `error` — error message overlay with retry

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/CopilotConnectionPanel.spec.ts`
Expected: PASS (all 9 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CopilotConnectionPanel.vue frontend/src/components/CopilotConnectionPanel.spec.ts
git commit -m "feat: add CopilotConnectionPanel with device flow authentication"
```

---

### Task 4: Wire `CopilotConnectionPanel` into settings, delete `GitHubAppSettings`

**Files:**
- Modify: `frontend/src/views/UnifiedSettingsView.vue`
- Delete: `frontend/src/components/GitHubAppSettings.vue`

- [ ] **Step 1: Update UnifiedSettingsView**

In `frontend/src/views/UnifiedSettingsView.vue`:

1. Replace the import:
```ts
// Remove:
import GitHubAppSettings from '../components/GitHubAppSettings.vue'
// Add:
import CopilotConnectionPanel from '../components/CopilotConnectionPanel.vue'
```

2. Replace the template usage (around line 651):
```vue
<!-- Remove: -->
<GitHubAppSettings v-if="orgId" :org-id="orgId" :is-admin="isAdmin ?? false" />
<!-- Add: -->
<CopilotConnectionPanel v-if="orgId" :org-id="orgId" />
```

- [ ] **Step 2: Delete GitHubAppSettings.vue**

```bash
rm frontend/src/components/GitHubAppSettings.vue
```

- [ ] **Step 3: Run full test suite**

Run: `cd frontend && npx vitest run`
Expected: All pass. No other file imports `GitHubAppSettings`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/UnifiedSettingsView.vue
git rm frontend/src/components/GitHubAppSettings.vue
git commit -m "feat: replace GitHubAppSettings with CopilotConnectionPanel in settings"
```

---

### Task 5: Create `CmdKSearchResults` component

**Files:**
- Create: `frontend/src/components/CmdKSearchResults.vue`
- Create: `frontend/src/components/CmdKSearchResults.spec.ts`

This component renders filtered dashboard results with keyboard navigation. It receives the search query as a prop, fetches dashboards from `listDashboards(orgId)`, filters client-side, and emits navigation/chat events.

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/CmdKSearchResults.spec.ts`:

```ts
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import CmdKSearchResults from './CmdKSearchResults.vue'

const mockDashboards = ref([
  { id: 'd1', title: 'HTTP Overview', description: 'HTTP metrics dashboard' },
  { id: 'd2', title: 'Node Exporter', description: 'System metrics' },
])

vi.mock('../api/dashboards', () => ({
  listDashboards: vi.fn().mockImplementation(() => Promise.resolve(mockDashboards.value)),
}))

const mockIsConnected = ref(false)
vi.mock('../composables/useCopilot', () => ({
  useCopilot: () => ({ isConnected: mockIsConnected }),
}))

const mockCurrentOrgId = ref('org-1')
vi.mock('../composables/useOrganization', () => ({
  useOrganization: () => ({ currentOrgId: mockCurrentOrgId }),
}))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('CmdKSearchResults', () => {
  let wrapper: VueWrapper

  function createWrapper(props: { query: string } = { query: '' }) {
    return mount(CmdKSearchResults, {
      props,
      global: {
        stubs: {
          LayoutGrid: { template: '<span class="icon-grid" />' },
          Sparkles: { template: '<span class="icon-sparkles" />' },
        },
      },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsConnected.value = false
    mockDashboards.value = [
      { id: 'd1', title: 'HTTP Overview', description: 'HTTP metrics dashboard' },
      { id: 'd2', title: 'Node Exporter', description: 'System metrics' },
    ]
  })

  afterEach(() => { wrapper?.unmount() })

  it('shows all dashboards when query is empty', async () => {
    wrapper = createWrapper({ query: '' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const items = wrapper.findAll('[data-testid^="search-result-"]')
    expect(items).toHaveLength(2)
  })

  it('filters dashboards by title match', async () => {
    wrapper = createWrapper({ query: 'HTTP' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const items = wrapper.findAll('[data-testid^="search-result-"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('HTTP Overview')
  })

  it('shows empty state when no results match', async () => {
    wrapper = createWrapper({ query: 'nonexistent' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="search-empty"]').exists()).toBe(true)
  })

  it('shows "Ask Copilot" option when connected and query is non-empty', async () => {
    mockIsConnected.value = true
    wrapper = createWrapper({ query: 'show me metrics' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="ask-copilot-option"]').exists()).toBe(true)
  })

  it('does NOT show "Ask Copilot" option when not connected', async () => {
    mockIsConnected.value = false
    wrapper = createWrapper({ query: 'show me metrics' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="ask-copilot-option"]').exists()).toBe(false)
  })

  it('emits navigate with dashboard id when result is clicked', async () => {
    wrapper = createWrapper({ query: '' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="search-result-d1"]').trigger('click')
    expect(wrapper.emitted('navigate')).toBeTruthy()
    expect(wrapper.emitted('navigate')![0]).toEqual(['/app/dashboards/d1'])
  })

  it('emits enter-chat with query when Ask Copilot is clicked', async () => {
    mockIsConnected.value = true
    wrapper = createWrapper({ query: 'show me metrics' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="ask-copilot-option"]').trigger('click')
    expect(wrapper.emitted('enter-chat')).toBeTruthy()
    expect(wrapper.emitted('enter-chat')![0]).toEqual(['show me metrics'])
  })

  it('handles listDashboards failure gracefully', async () => {
    const { listDashboards } = await import('../api/dashboards')
    vi.mocked(listDashboards).mockRejectedValueOnce(new Error('Network error'))
    wrapper = createWrapper({ query: '' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    // Should show empty state, not crash
    expect(wrapper.find('[data-testid="search-empty"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/CmdKSearchResults.spec.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement CmdKSearchResults.vue**

Create `frontend/src/components/CmdKSearchResults.vue`. The component:
- Fetches dashboards via `listDashboards(orgId)` on mount (with error handling — show empty on failure)
- Filters by `query` prop against `title` and `description` (case-insensitive)
- Renders scrollable list with `data-testid="search-result-{id}"` per item
- Shows `data-testid="search-empty"` when no results
- Shows `data-testid="ask-copilot-option"` at bottom when `isConnected && query.length > 0`
- Emits `navigate(path: string)` and `enter-chat(query: string)`
- Keyboard nav: ArrowUp/Down to select, Enter to activate

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/CmdKSearchResults.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CmdKSearchResults.vue frontend/src/components/CmdKSearchResults.spec.ts
git commit -m "feat: add CmdKSearchResults with dashboard filtering and keyboard nav"
```

---

### Task 6: Create `CmdKChatView` component

**Files:**
- Create: `frontend/src/components/CmdKChatView.vue`
- Create: `frontend/src/components/CmdKChatView.spec.ts`

This is the most complex component. It implements the multi-turn tool-calling chat loop with `sendChatRequest()`, renders messages with markdown, intercepts `generate_dashboard` to show `DashboardSpecPreview`, and shows tool call status.

**Key dependencies to import:**
- `useCopilot` — `sendChatRequest`, `models`, `selectedModel`, `fetchModels`, `isLoading`, `error`
- `getMetricsTools` from `useCopilotTools`
- `useCopilotToolExecutor` from `useCopilotTools`
- `useCommandContext` — for datasource context
- `renderMarkdown` from `utils/markdown`
- `validateDashboardSpec` from `utils/dashboardSpec`
- `DashboardSpecPreview` component

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/CmdKChatView.spec.ts`. Test:
1. Sends initial message on mount via `sendChatRequest`
2. Renders user and assistant messages
3. Shows tool call status indicators
4. Renders `DashboardSpecPreview` when `generate_dashboard` is intercepted
5. Handles JSON parse error in `generate_dashboard` gracefully
6. Shows error when API fails
7. Emits `exit-chat` when "Back to search" is clicked
8. Disables input while loading
9. Shows model selector dropdown

```ts
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import CmdKChatView from './CmdKChatView.vue'

const mockSendChatRequest = vi.fn()
const mockFetchModels = vi.fn()
const mockModels = ref([])
const mockSelectedModel = ref('')
const mockIsLoading = ref(false)
const mockError = ref<string | null>(null)

vi.mock('../composables/useCopilot', () => ({
  useCopilot: () => ({
    sendChatRequest: mockSendChatRequest,
    fetchModels: mockFetchModels,
    models: mockModels,
    selectedModel: mockSelectedModel,
    isLoading: mockIsLoading,
    error: mockError,
  }),
}))

vi.mock('../composables/useCopilotTools', () => ({
  getMetricsTools: () => [],
  getVictoriaMetricsTools: () => [],
  useCopilotToolExecutor: () => ({
    executeTool: vi.fn().mockResolvedValue('tool result'),
  }),
}))

vi.mock('../composables/useCommandContext', () => ({
  useCommandContext: () => ({
    currentContext: ref({ viewName: 'Test', datasourceId: 'ds-1' }),
  }),
}))

vi.mock('../utils/markdown', () => ({
  initMarkdown: vi.fn(),
  renderMarkdown: vi.fn().mockResolvedValue('<p>rendered</p>'),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('CmdKChatView', () => {
  let wrapper: VueWrapper

  function createWrapper(props = { initialQuery: 'hello', datasourceType: 'victoriametrics', datasourceName: 'default', datasourceId: 'ds-1' }) {
    return mount(CmdKChatView, {
      props,
      global: {
        stubs: {
          DashboardSpecPreview: { template: '<div data-testid="dashboard-spec-preview" />' },
          ArrowLeft: { template: '<span />' },
          Send: { template: '<span />' },
          Loader2: { template: '<span />' },
          ChevronDown: { template: '<span />' },
          Sparkles: { template: '<span />' },
        },
      },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLoading.value = false
    mockError.value = null
    mockModels.value = []
    mockSendChatRequest.mockResolvedValue({ content: 'Hello!', toolCalls: [] })
  })

  afterEach(() => { wrapper?.unmount() })

  it('sends initial query via sendChatRequest on mount', async () => {
    wrapper = createWrapper()
    await wrapper.vm.$nextTick()
    expect(mockSendChatRequest).toHaveBeenCalled()
  })

  it('shows the user message in the chat', () => {
    wrapper = createWrapper()
    expect(wrapper.text()).toContain('hello')
  })

  it('emits exit-chat when back button is clicked', async () => {
    wrapper = createWrapper()
    await wrapper.find('[data-testid="chat-back-btn"]').trigger('click')
    expect(wrapper.emitted('exit-chat')).toBeTruthy()
  })

  it('disables textarea when loading', async () => {
    mockIsLoading.value = true
    wrapper = createWrapper()
    const textarea = wrapper.find('[data-testid="chat-input"]')
    expect((textarea.element as HTMLTextAreaElement).disabled).toBe(true)
  })

  it('shows error message when error exists', async () => {
    mockError.value = 'API failed'
    wrapper = createWrapper()
    expect(wrapper.text()).toContain('API failed')
  })

  it('shows model selector when models are available', async () => {
    mockModels.value = [{ id: 'gpt-4', name: 'GPT-4', vendor: 'openai', category: 'chat', preview: false, premium_multiplier: 1 }]
    wrapper = createWrapper()
    expect(wrapper.find('[data-testid="model-selector"]').exists()).toBe(true)
  })

  it('calls fetchModels on mount', () => {
    wrapper = createWrapper()
    expect(mockFetchModels).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/CmdKChatView.spec.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement CmdKChatView.vue**

Create `frontend/src/components/CmdKChatView.vue`. Key implementation details:

**Props:** `initialQuery: string`, `datasourceType: string`, `datasourceName: string`, `datasourceId: string`
**Emits:** `exit-chat`

**Tool calling loop** (in an async function `handleSend`):
```ts
const MAX_TOOL_ITERATIONS = 10

async function handleSend(userMessage: string) {
  messages.value.push({ role: 'user', content: userMessage })
  const chatMessages = buildChatMessages()
  const tools = getMetricsTools()

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const { content, toolCalls } = await sendChatRequest(
      props.datasourceType, props.datasourceName, chatMessages, tools
    )

    if (content) {
      messages.value.push({ role: 'assistant', content })
    }

    if (!toolCalls.length) break

    for (const tc of toolCalls) {
      if (tc.function.name === 'generate_dashboard') {
        try {
          const spec = JSON.parse(tc.function.arguments)
          // inject datasource_id into all panels
          spec.panels?.forEach(p => { if (p.query) p.query.datasource_id = props.datasourceId })
          dashboardSpec.value = spec
        } catch {
          messages.value.push({ role: 'assistant', content: 'Failed to parse dashboard specification.' })
        }
        return // exit loop on generate_dashboard
      }

      // Execute other tools
      toolStatuses.value.push({ name: tc.function.name, status: 'running' })
      const result = await executeTool(tc).catch(err => {
        toolStatuses.value[toolStatuses.value.length - 1]!.status = 'error'
        return `Error: ${err instanceof Error ? err.message : 'Tool execution failed'}`
      })
      if (toolStatuses.value[toolStatuses.value.length - 1]!.status === 'running') {
        toolStatuses.value[toolStatuses.value.length - 1]!.status = 'complete'
      }
      chatMessages.push(
        { role: 'assistant', content: null, tool_calls: [tc] },
        { role: 'tool', tool_call_id: tc.id, content: result }
      )
    }
  }
}
```

**Render `DashboardSpecPreview`** when `dashboardSpec` is set.
**Markdown rendering:** Use `renderMarkdown()` for assistant messages via a `watch` + `renderedHtml` cache pattern (same as deleted CopilotPanel).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/CmdKChatView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CmdKChatView.vue frontend/src/components/CmdKChatView.spec.ts
git commit -m "feat: add CmdKChatView with tool-calling loop and DashboardSpecPreview"
```

---

### Task 7: Rewire `CmdKModal` as orchestrator

**Files:**
- Modify: `frontend/src/components/CmdKModal.vue`
- Modify: `frontend/src/components/CmdKModal.spec.ts`

Convert the stub modal into an orchestrator that switches between `CmdKSearchResults` (default) and `CmdKChatView` (when copilot chat is activated).

- [ ] **Step 1: Add new tests to existing spec**

Append to `frontend/src/components/CmdKModal.spec.ts`. Add mocks for new dependencies and tests for:
- Search results render when modal is open
- Mode switches to chat when `enter-chat` is emitted from search results
- Mode switches back to search when `exit-chat` is emitted from chat view
- Not-connected message shows when trying to chat without connection
- Query resets when modal closes

```ts
// Add these to the existing describe block:

it('renders CmdKSearchResults in search mode', () => {
  wrapper = createWrapper({ isOpen: true })
  expect(wrapper.findComponent({ name: 'CmdKSearchResults' }).exists()).toBe(true)
})

it('switches to chat mode when enter-chat is emitted', async () => {
  mockIsConnected.value = true
  wrapper = createWrapper({ isOpen: true })
  // Simulate entering chat
  await wrapper.findComponent({ name: 'CmdKSearchResults' }).vm.$emit('enter-chat', 'test query')
  await wrapper.vm.$nextTick()
  expect(wrapper.findComponent({ name: 'CmdKChatView' }).exists()).toBe(true)
})

it('shows not-connected message when trying to chat without connection', async () => {
  mockIsConnected.value = false
  wrapper = createWrapper({ isOpen: true })
  // Simulate search results emitting enter-chat
  await wrapper.findComponent({ name: 'CmdKSearchResults' }).vm.$emit('enter-chat', 'test')
  await wrapper.vm.$nextTick()
  expect(wrapper.find('[data-testid="not-connected-message"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="not-connected-message"]').text()).toContain('Settings')
})
```

- [ ] **Step 2: Run tests to verify new ones fail**

Run: `cd frontend && npx vitest run src/components/CmdKModal.spec.ts`
Expected: New tests FAIL.

- [ ] **Step 3: Update CmdKModal.vue**

Modify `frontend/src/components/CmdKModal.vue`:

1. Add imports for `CmdKSearchResults`, `CmdKChatView`, `useCopilot`, `useOrganization`, `useCommandContext`
2. Add mode state: `const mode = ref<'search' | 'chat'>('search')`
3. Add `chatQuery` ref for passing query to chat view
4. Handle `enter-chat` event: check `isConnected`, if yes switch mode, if no show message
5. Handle `exit-chat` event: switch back to search mode
6. Handle `navigate` event: emit `close`, then router push
7. Reset mode to `search` when modal closes
8. Pass datasource info from `currentContext` to `CmdKChatView`

Template: conditionally render `CmdKSearchResults` or `CmdKChatView` below the input area based on `mode`. Add a "not connected" inline message with router-link to `/app/settings/ai`.

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd frontend && npx vitest run src/components/CmdKModal.spec.ts`
Expected: All pass (existing + new).

- [ ] **Step 5: Run full test suite**

Run: `cd frontend && npx vitest run`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/CmdKModal.vue frontend/src/components/CmdKModal.spec.ts
git commit -m "feat: wire CmdKModal as orchestrator for search + chat modes"
```

---

### Task 8: Lint, type-check, and final verification

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run linter**

Run: `cd frontend && npm run lint:fix`
Expected: Clean or auto-fixed.

- [ ] **Step 3: Run full test suite**

Run: `cd frontend && npm run test`
Expected: All pass.

- [ ] **Step 4: Manual smoke test (if dev server available)**

Start: `cd frontend && npm run dev`
1. Navigate to Settings > AI Configuration — see CopilotConnectionPanel with "Connect" button
2. Open Cmd+K (Ctrl+K) — see search input, type to filter dashboards
3. Verify "Ask Copilot" option appears only when connected

- [ ] **Step 5: Commit any lint fixes**

```bash
git add -A && git commit -m "chore: lint fixes"
```

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// --- Hoisted mock functions ---

const mockFetchModels = vi.hoisted(() => vi.fn())
const mockGenerate = vi.hoisted(() => vi.fn())
const mockCancel = vi.hoisted(() => vi.fn())
const mockGetToolsForDatasourceType = vi.hoisted(() => vi.fn().mockReturnValue([]))

// --- Shared reactive state ---

const mockChatMessages = ref<Array<{ role: string; content: string }>>([])
const mockModels = ref<Array<{ id: string; name: string; provider_id?: string; provider_name?: string }>>([])
const mockSelectedModel = ref('')
const mockIsLoading = ref(false)
const mockProviderError = ref<string | null>(null)
const mockProviders = ref<Array<{ id: string; display_name: string }>>([])
const mockSelectedProviderId = ref('')

const mockIsGenerating = ref(false)
const mockGenError = ref<string | null>(null)
const mockToolStatuses = ref<Array<{ name: string; status: string }>>([])

vi.mock('../composables/useAIProvider', () => ({
  useAIProvider: () => ({
    chatMessages: mockChatMessages,
    models: mockModels,
    selectedModel: mockSelectedModel,
    selectedProviderId: mockSelectedProviderId,
    fetchModels: mockFetchModels,
    isLoading: mockIsLoading,
    error: mockProviderError,
    providers: mockProviders,
  }),
}))

vi.mock('../composables/useDashboardGeneration', () => ({
  useDashboardGeneration: () => ({
    generate: mockGenerate,
    cancel: mockCancel,
    toolStatuses: mockToolStatuses,
    isGenerating: mockIsGenerating,
    error: mockGenError,
    progressText: ref(''),
  }),
}))

vi.mock('../composables/useCopilotTools', () => ({
  getToolsForDatasourceType: mockGetToolsForDatasourceType,
}))

vi.mock('../composables/useOrganization', () => ({
  useOrganization: () => ({
    currentOrg: ref({ id: 'org-1', name: 'Test Org' }),
  }),
}))

vi.mock('../composables/useCommandContext', () => ({
  useCommandContext: () => ({
    currentContext: ref(null),
  }),
}))

vi.mock('../utils/markdown', () => ({
  initMarkdown: vi.fn().mockResolvedValue(undefined),
  renderMarkdown: vi.fn().mockResolvedValue('<p>rendered</p>'),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// --- Import component after mocks ---

import CmdKChatView from './CmdKChatView.vue'

// --- Helpers ---

const defaultProps = {
  initialQuery: 'show me metrics',
  datasourceType: 'victoriametrics',
  datasourceName: 'VictoriaMetrics',
  datasourceId: 'ds-1',
}

function createWrapper(props = defaultProps) {
  return mount(CmdKChatView, {
    props,
    global: {
      stubs: {
        DashboardSpecPreview: {
          name: 'DashboardSpecPreview',
          template: '<div data-testid="dashboard-spec-preview">Preview</div>',
          props: ['spec'],
        },
      },
    },
  })
}

// --- Tests ---

describe('CmdKChatView', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    vi.clearAllMocks()
    mockChatMessages.value = []
    mockModels.value = []
    mockSelectedModel.value = ''
    mockIsLoading.value = false
    mockIsGenerating.value = false
    mockProviderError.value = null
    mockGenError.value = null
    mockProviders.value = []
    mockToolStatuses.value = []
    mockGenerate.mockResolvedValue({ spec: null, content: null })
    mockFetchModels.mockResolvedValue(undefined)
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('sends initial query via generate on mount', async () => {
    wrapper = createWrapper()
    await flushPromises()

    expect(mockGenerate).toHaveBeenCalledOnce()
    const callArgs = mockGenerate.mock.calls[0]!
    const messages = callArgs[0] as Array<{ role: string; content: string }>
    expect(messages.some((m) => m.role === 'user' && m.content === 'show me metrics')).toBe(true)
  })

  it('shows user message text in chat', async () => {
    wrapper = createWrapper()
    await flushPromises()

    expect(
      mockChatMessages.value.some((m) => m.role === 'user' && m.content === 'show me metrics'),
    ).toBe(true)
    expect(wrapper.text()).toContain('show me metrics')
  })

  it('emits exit-chat when back button clicked', async () => {
    wrapper = createWrapper()
    await flushPromises()

    const backBtn = wrapper.find('[data-testid="chat-back-btn"]')
    expect(backBtn.exists()).toBe(true)
    await backBtn.trigger('click')

    expect(wrapper.emitted('exit-chat')).toBeTruthy()
  })

  it('disables textarea when generating', async () => {
    mockIsGenerating.value = true
    mockGenerate.mockImplementation(() => new Promise(() => {}))
    wrapper = createWrapper()
    await flushPromises()

    const textarea = wrapper.find('[data-testid="chat-input"]')
    expect(textarea.exists()).toBe(true)
    expect(textarea.attributes('disabled')).toBeDefined()
  })

  it('shows error message when genError exists', async () => {
    wrapper = createWrapper()
    await flushPromises()

    mockGenError.value = 'Something went wrong'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Something went wrong')
  })

  it('shows model selector when models available', async () => {
    mockModels.value = [
      { id: 'model-1', name: 'Claude Sonnet' },
      { id: 'model-2', name: 'GPT-4o' },
    ]
    wrapper = createWrapper()
    await flushPromises()

    const modelSelector = wrapper.find('[data-testid="model-selector"]')
    expect(modelSelector.exists()).toBe(true)
  })

  it('does not show model selector when no models available', async () => {
    mockModels.value = []
    wrapper = createWrapper()
    await flushPromises()

    const modelSelector = wrapper.find('[data-testid="model-selector"]')
    expect(modelSelector.exists()).toBe(false)
  })

  it('groups models by provider when multiple providers exist', async () => {
    mockProviders.value = [
      { id: 'prov-1', display_name: 'OpenAI' },
      { id: 'prov-2', display_name: 'Copilot' },
    ]
    mockModels.value = [
      { id: 'gpt-4o', name: 'GPT-4o', provider_id: 'prov-1', provider_name: 'OpenAI' },
      { id: 'claude-sonnet', name: 'Claude Sonnet', provider_id: 'prov-2', provider_name: 'Copilot' },
    ]
    wrapper = createWrapper()
    await flushPromises()

    const modelSelector = wrapper.find('[data-testid="model-selector"]')
    const optgroups = modelSelector.findAll('optgroup')
    expect(optgroups.length).toBe(2)
    expect(optgroups[0]!.attributes('label')).toBe('OpenAI')
    expect(optgroups[1]!.attributes('label')).toBe('Copilot')
  })

  it('shows flat options when single provider exists', async () => {
    mockProviders.value = [
      { id: 'prov-1', display_name: 'OpenAI' },
    ]
    mockModels.value = [
      { id: 'gpt-4o', name: 'GPT-4o', provider_id: 'prov-1', provider_name: 'OpenAI' },
      { id: 'gpt-4', name: 'GPT-4', provider_id: 'prov-1', provider_name: 'OpenAI' },
    ]
    wrapper = createWrapper()
    await flushPromises()

    const modelSelector = wrapper.find('[data-testid="model-selector"]')
    const optgroups = modelSelector.findAll('optgroup')
    expect(optgroups.length).toBe(0)
  })

  it('calls fetchModels on mount', async () => {
    wrapper = createWrapper()
    await flushPromises()

    expect(mockFetchModels).toHaveBeenCalledOnce()
  })

  it('prepends system message with datasource info when datasourceId is set', async () => {
    wrapper = createWrapper()
    await flushPromises()

    const callArgs = mockGenerate.mock.calls[0]!
    const messages = callArgs[0] as Array<{ role: string; content: string }>
    const systemMsg = messages.find((m) => m.role === 'system')
    expect(systemMsg).toBeDefined()
    expect(systemMsg!.content).toContain('ds-1')
    expect(systemMsg!.content).toContain('VictoriaMetrics')
  })

  it('prepends system message instructing list_datasources when datasourceId is empty', async () => {
    wrapper = createWrapper({
      ...defaultProps,
      datasourceId: '',
      datasourceType: '',
      datasourceName: '',
    })
    await flushPromises()

    const callArgs = mockGenerate.mock.calls[0]!
    const messages = callArgs[0] as Array<{ role: string; content: string }>
    const systemMsg = messages.find((m) => m.role === 'system')
    expect(systemMsg).toBeDefined()
    expect(systemMsg!.content).toContain('list_datasources')
  })

  it('uses getToolsForDatasourceType with correct type', async () => {
    wrapper = createWrapper()
    await flushPromises()

    expect(mockGetToolsForDatasourceType).toHaveBeenCalledWith('victoriametrics')
  })
})

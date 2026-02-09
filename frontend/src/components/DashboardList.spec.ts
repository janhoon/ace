import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import DashboardList from './DashboardList.vue'
import * as dashboardApi from '../api/dashboards'
import * as folderApi from '../api/folders'

const mockCurrentOrgId = ref<string | null>('org-1')
const mockCurrentOrg = ref({
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  role: 'admin' as const,
  created_at: '2026-02-08T00:00:00Z',
  updated_at: '2026-02-08T00:00:00Z',
})
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockRoute = ref({
  query: {} as Record<string, unknown>,
})

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useRoute: () => mockRoute.value,
}))

vi.mock('../composables/useOrganization', () => ({
  useOrganization: () => ({
    currentOrgId: mockCurrentOrgId,
    currentOrg: mockCurrentOrg,
  }),
}))

vi.mock('../api/dashboards')
vi.mock('../api/folders')

const mockDashboards = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    folder_id: 'folder-a',
    title: 'Test Dashboard',
    description: 'Test description',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '223e4567-e89b-12d3-a456-426614174001',
    folder_id: null,
    title: 'Another Dashboard',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  {
    id: '323e4567-e89b-12d3-a456-426614174002',
    folder_id: 'missing-folder',
    title: 'Needs Reassignment',
    description: 'Folder was deleted',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  },
]

const mockFolders = [
  {
    id: 'folder-a',
    organization_id: 'org-1',
    parent_id: null,
    name: 'Operations',
    sort_order: 0,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'folder-b',
    organization_id: 'org-1',
    parent_id: null,
    name: 'Product',
    sort_order: 1,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

describe('DashboardList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentOrgId.value = 'org-1'
    mockRoute.value = { query: {} }
    mockCurrentOrg.value = {
      id: 'org-1',
      name: 'Acme',
      slug: 'acme',
      role: 'admin',
      created_at: '2026-02-08T00:00:00Z',
      updated_at: '2026-02-08T00:00:00Z',
    }
  })

  it('displays loading state initially', () => {
    vi.mocked(dashboardApi.listDashboards).mockImplementation(() => new Promise(() => {}))
    vi.mocked(folderApi.listFolders).mockImplementation(() => new Promise(() => {}))
    const wrapper = mount(DashboardList)
    expect(wrapper.text()).toContain('Loading dashboards...')
  })

  it('displays dashboards grouped by folders', async () => {
    vi.mocked(dashboardApi.listDashboards).mockResolvedValue(mockDashboards)
    vi.mocked(folderApi.listFolders).mockResolvedValue(mockFolders)

    const wrapper = mount(DashboardList)
    await flushPromises()

    expect(wrapper.text()).toContain('Operations')
    expect(wrapper.text()).toContain('Product')
    expect(wrapper.text()).toContain('Unfiled Dashboards')

    const operationsSection = wrapper.find('[data-testid="folder-section-folder-a"]')
    expect(operationsSection.text()).toContain('Test Dashboard')

    const unfiledSection = wrapper.find('[data-testid="folder-section-unfiled"]')
    expect(unfiledSection.text()).toContain('Another Dashboard')
    expect(unfiledSection.text()).toContain('Needs Reassignment')
  })

  it('displays empty state when no dashboards and no folders', async () => {
    vi.mocked(dashboardApi.listDashboards).mockResolvedValue([])
    vi.mocked(folderApi.listFolders).mockResolvedValue([])

    const wrapper = mount(DashboardList)
    await flushPromises()

    expect(wrapper.text()).toContain('No dashboards yet')
  })

  it('displays error state on fetch failure', async () => {
    vi.mocked(dashboardApi.listDashboards).mockRejectedValue(new Error('Network error'))
    vi.mocked(folderApi.listFolders).mockResolvedValue([])

    const wrapper = mount(DashboardList)
    await flushPromises()

    expect(wrapper.text()).toContain('Network error')
  })

  it('opens create modal when button is clicked', async () => {
    vi.mocked(dashboardApi.listDashboards).mockResolvedValue([])
    vi.mocked(folderApi.listFolders).mockResolvedValue([])

    const wrapper = mount(DashboardList)
    await flushPromises()

    await wrapper.find('.page-header .btn-primary').trigger('click')
    expect(wrapper.findComponent({ name: 'CreateDashboardModal' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'CreateDashboardModal' }).props('initialMode')).toBe('create')
  })

  it('opens create modal in grafana mode from dashboard query param', async () => {
    mockRoute.value = {
      query: {
        newDashboardMode: 'grafana',
      },
    }
    vi.mocked(dashboardApi.listDashboards).mockResolvedValue([])
    vi.mocked(folderApi.listFolders).mockResolvedValue([])

    const wrapper = mount(DashboardList)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'CreateDashboardModal' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'CreateDashboardModal' }).props('initialMode')).toBe('grafana')
    expect(mockReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('shows new folder action for admin and editor only', async () => {
    vi.mocked(dashboardApi.listDashboards).mockResolvedValue(mockDashboards)
    vi.mocked(folderApi.listFolders).mockResolvedValue(mockFolders)

    const adminWrapper = mount(DashboardList)
    await flushPromises()
    expect(adminWrapper.find('[data-testid="new-folder-header"]').exists()).toBe(true)

    mockCurrentOrg.value = {
      ...mockCurrentOrg.value,
      role: 'editor',
    }
    const editorWrapper = mount(DashboardList)
    await flushPromises()
    expect(editorWrapper.find('[data-testid="new-folder-header"]').exists()).toBe(true)

    mockCurrentOrg.value = {
      ...mockCurrentOrg.value,
      role: 'viewer',
    }
    const viewerWrapper = mount(DashboardList)
    await flushPromises()
    expect(viewerWrapper.find('[data-testid="new-folder-header"]').exists()).toBe(false)
  })

  it('shows no-folder CTA and creates folder from CTA action', async () => {
    vi.mocked(dashboardApi.listDashboards)
      .mockResolvedValueOnce([
        {
          id: '223e4567-e89b-12d3-a456-426614174001',
          folder_id: null,
          title: 'Another Dashboard',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([])
    vi.mocked(folderApi.listFolders)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    vi.mocked(folderApi.createFolder).mockResolvedValue({
      id: 'new-folder',
      organization_id: 'org-1',
      parent_id: null,
      name: 'Operations',
      sort_order: 0,
      created_by: 'user-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })

    const wrapper = mount(DashboardList)
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-empty-cta"]').exists()).toBe(true)

    await wrapper.get('[data-testid="new-folder-cta"]').trigger('click')
    await wrapper.get('#folder-name').setValue('Operations')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(vi.mocked(folderApi.createFolder)).toHaveBeenCalledWith('org-1', { name: 'Operations' })
    expect(vi.mocked(dashboardApi.listDashboards).mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(vi.mocked(folderApi.listFolders).mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('renders dashboard cards for grouped dashboards', async () => {
    vi.mocked(dashboardApi.listDashboards).mockResolvedValue(mockDashboards)
    vi.mocked(folderApi.listFolders).mockResolvedValue(mockFolders)

    const wrapper = mount(DashboardList)
    await flushPromises()

    const cards = wrapper.findAll('.dashboard-card')
    expect(cards.length).toBe(3)
  })

  it('shows folder permissions action only for admins', async () => {
    vi.mocked(dashboardApi.listDashboards).mockResolvedValue(mockDashboards)
    vi.mocked(folderApi.listFolders).mockResolvedValue(mockFolders)

    const adminWrapper = mount(DashboardList)
    await flushPromises()

    expect(adminWrapper.find('[data-testid="folder-permissions-folder-a"]').exists()).toBe(true)

    mockCurrentOrg.value = {
      ...mockCurrentOrg.value,
      role: 'viewer',
    }
    const viewerWrapper = mount(DashboardList)
    await flushPromises()

    expect(viewerWrapper.find('[data-testid="folder-permissions-folder-a"]').exists()).toBe(false)
  })

  it('does not fetch dashboards when no organization is selected', async () => {
    mockCurrentOrgId.value = null

    const wrapper = mount(DashboardList)
    await flushPromises()

    expect(vi.mocked(dashboardApi.listDashboards)).not.toHaveBeenCalled()
    expect(vi.mocked(folderApi.listFolders)).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('No dashboards yet')
  })

  it('does not render folder create controls for viewers in empty states', async () => {
    mockCurrentOrg.value = {
      ...mockCurrentOrg.value,
      role: 'viewer',
    }
    vi.mocked(dashboardApi.listDashboards).mockResolvedValue([])
    vi.mocked(folderApi.listFolders).mockResolvedValue([])

    const wrapper = mount(DashboardList)
    await flushPromises()

    expect(wrapper.find('[data-testid="new-folder-empty"]').exists()).toBe(false)
  })

  it('refreshes dashboard sections after folder permission updates', async () => {
    vi.mocked(dashboardApi.listDashboards)
      .mockResolvedValueOnce(mockDashboards)
      .mockResolvedValueOnce([])
    vi.mocked(folderApi.listFolders)
      .mockResolvedValueOnce(mockFolders)
      .mockResolvedValueOnce([])

    const wrapper = mount(DashboardList, {
      global: {
        stubs: {
          FolderPermissionsModal: {
            name: 'FolderPermissionsModal',
            emits: ['saved', 'close'],
            template: '<button data-testid="emit-folder-saved" @click="$emit(\'saved\')"></button>',
          },
        },
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="folder-permissions-folder-a"]').trigger('click')
    await wrapper.get('[data-testid="emit-folder-saved"]').trigger('click')
    await flushPromises()

    expect(vi.mocked(dashboardApi.listDashboards).mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(vi.mocked(folderApi.listFolders).mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(wrapper.text()).toContain('No dashboards yet')
  })
})

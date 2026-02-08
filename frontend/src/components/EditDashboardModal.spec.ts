import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import EditDashboardModal from './EditDashboardModal.vue'
import * as api from '../api/dashboards'

vi.mock('../api/dashboards')

const mockDashboard = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  folder_id: 'folder-1',
  title: 'Existing Dashboard',
  description: 'Existing description',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

const mockFolders = [
  {
    id: 'folder-1',
    organization_id: 'org-1',
    parent_id: null,
    name: 'Operations',
    sort_order: 0,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'folder-2',
    organization_id: 'org-1',
    parent_id: null,
    name: 'Product',
    sort_order: 1,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

describe('EditDashboardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with existing dashboard data', () => {
    const wrapper = mount(EditDashboardModal, {
      props: { dashboard: mockDashboard, folders: mockFolders }
    })
    const titleInput = wrapper.find('input#title')
    const descInput = wrapper.find('textarea#description')
    const folderSelect = wrapper.find('select#folder')
    expect((titleInput.element as HTMLInputElement).value).toBe('Existing Dashboard')
    expect((descInput.element as HTMLTextAreaElement).value).toBe('Existing description')
    expect((folderSelect.element as HTMLSelectElement).value).toBe('folder-1')
  })

  it('emits close event when cancel is clicked', async () => {
    const wrapper = mount(EditDashboardModal, {
      props: { dashboard: mockDashboard, folders: mockFolders }
    })
    await wrapper.findAll('button').find(b => b.text() === 'Cancel')?.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('shows error when title is cleared', async () => {
    const wrapper = mount(EditDashboardModal, {
      props: { dashboard: mockDashboard, folders: mockFolders }
    })
    await wrapper.find('input#title').setValue('')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Title is required')
  })

  it('calls updateDashboard API on submit', async () => {
    vi.mocked(api.updateDashboard).mockResolvedValue({
      ...mockDashboard,
      title: 'Updated Title'
    })

    const wrapper = mount(EditDashboardModal, {
      props: { dashboard: mockDashboard, folders: mockFolders }
    })
    await wrapper.find('input#title').setValue('Updated Title')
    await wrapper.find('select#folder').setValue('folder-2')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.updateDashboard).toHaveBeenCalledWith(mockDashboard.id, {
      title: 'Updated Title',
      description: 'Existing description',
      folder_id: 'folder-2',
    })
    expect(wrapper.emitted('updated')).toBeTruthy()
  })

  it('can move dashboard back to root', async () => {
    vi.mocked(api.updateDashboard).mockResolvedValue(mockDashboard)

    const wrapper = mount(EditDashboardModal, {
      props: { dashboard: mockDashboard, folders: mockFolders }
    })
    await wrapper.find('select#folder').setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.updateDashboard).toHaveBeenCalledWith(mockDashboard.id, {
      title: 'Existing Dashboard',
      description: 'Existing description',
      folder_id: null,
    })
  })

  it('shows error on API failure', async () => {
    vi.mocked(api.updateDashboard).mockRejectedValue(new Error('Network error'))

    const wrapper = mount(EditDashboardModal, {
      props: { dashboard: mockDashboard, folders: mockFolders }
    })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to update dashboard')
  })
})

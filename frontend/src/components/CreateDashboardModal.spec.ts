import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CreateDashboardModal from './CreateDashboardModal.vue'
import * as api from '../api/dashboards'

vi.mock('../api/dashboards')
vi.mock('../composables/useOrganization', () => ({
  useOrganization: () => ({
    currentOrgId: { value: 'org-1' },
  }),
}))

describe('CreateDashboardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form fields', () => {
    const wrapper = mount(CreateDashboardModal)
    expect(wrapper.find('input#title').exists()).toBe(true)
    expect(wrapper.find('textarea#description').exists()).toBe(true)
  })

  it('emits close event when cancel is clicked', async () => {
    const wrapper = mount(CreateDashboardModal)
    await wrapper.findAll('button').find(b => b.text() === 'Cancel')?.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('shows error when title is empty', async () => {
    const wrapper = mount(CreateDashboardModal)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Title is required')
  })

  it('calls createDashboard API on submit', async () => {
    vi.mocked(api.createDashboard).mockResolvedValue({
      id: '123',
      title: 'New Dashboard',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    })

    const wrapper = mount(CreateDashboardModal)
    await wrapper.find('input#title').setValue('New Dashboard')
    await wrapper.find('textarea#description').setValue('Description')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.createDashboard).toHaveBeenCalledWith('org-1', {
      title: 'New Dashboard',
      description: 'Description',
    })
    expect(wrapper.emitted('created')).toBeTruthy()
  })

  it('shows error on API failure', async () => {
    vi.mocked(api.createDashboard).mockRejectedValue(new Error('Failed to create dashboard'))

    const wrapper = mount(CreateDashboardModal)
    await wrapper.find('input#title').setValue('New Dashboard')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to create dashboard')
  })

  it('imports dashboard from yaml file', async () => {
    vi.mocked(api.importDashboardYaml).mockResolvedValue({
      id: 'imported-1',
      title: 'Imported Dashboard',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })

    const wrapper = mount(CreateDashboardModal)
    await wrapper.findAll('button').find((button) => button.text() === 'Import YAML')?.trigger('click')

    const input = wrapper.find('input#yaml-file')
    const file = new File([
      'schema_version: 1\ndashboard:\n  title: Imported Dashboard\n  panels:\n    - title: Requests\n      type: line_chart\n    - title: Errors\n      type: stat\n',
    ], 'dashboard.yaml', { type: 'application/x-yaml' })

    Object.defineProperty(input.element, 'files', {
      value: [file],
      writable: false,
    })
    await input.trigger('change')
    await flushPromises()
    expect(wrapper.find('[data-testid="yaml-preview"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('2 panels')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.importDashboardYaml).toHaveBeenCalledWith('org-1', expect.stringContaining('dashboard:'))
    expect(wrapper.emitted('created')).toBeTruthy()
  })

  it('rejects invalid file extension in import mode', async () => {
    const wrapper = mount(CreateDashboardModal)
    await wrapper.findAll('button').find((button) => button.text() === 'Import YAML')?.trigger('click')

    const input = wrapper.find('input#yaml-file')
    const file = new File(['{}'], 'dashboard.json', { type: 'application/json' })

    Object.defineProperty(input.element, 'files', {
      value: [file],
      writable: false,
    })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('Please upload a .yaml or .yml file')
  })

  it('shows validation error for invalid dashboard yaml shape', async () => {
    const wrapper = mount(CreateDashboardModal)
    await wrapper.findAll('button').find((button) => button.text() === 'Import YAML')?.trigger('click')

    const input = wrapper.find('input#yaml-file')
    const file = new File(['schema_version: 1\nname: invalid\n'], 'dashboard.yaml', {
      type: 'application/x-yaml',
    })

    Object.defineProperty(input.element, 'files', {
      value: [file],
      writable: false,
    })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('Invalid YAML file. Missing dashboard section')
  })
})

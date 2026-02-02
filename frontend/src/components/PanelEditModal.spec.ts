import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PanelEditModal from './PanelEditModal.vue'
import * as api from '../api/panels'

vi.mock('../api/panels')
vi.mock('../composables/useProm', () => ({
  queryPrometheus: vi.fn()
}))

describe('PanelEditModal', () => {
  const dashboardId = 'dashboard-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form fields', () => {
    const wrapper = mount(PanelEditModal, {
      props: { dashboardId }
    })
    expect(wrapper.find('input#title').exists()).toBe(true)
    expect(wrapper.find('select#type').exists()).toBe(true)
    // QueryEditor component is now used instead of textarea
    expect(wrapper.findComponent({ name: 'QueryEditor' }).exists()).toBe(true)
  })

  it('shows "Add Panel" title when creating new panel', () => {
    const wrapper = mount(PanelEditModal, {
      props: { dashboardId }
    })
    expect(wrapper.find('.modal-header h2').text()).toBe('Add Panel')
  })

  it('shows "Edit Panel" title when editing existing panel', () => {
    const wrapper = mount(PanelEditModal, {
      props: {
        dashboardId,
        panel: {
          id: '1',
          dashboard_id: dashboardId,
          title: 'Existing Panel',
          type: 'line_chart',
          grid_pos: { x: 0, y: 0, w: 6, h: 4 },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      }
    })
    expect(wrapper.find('.modal-header h2').text()).toBe('Edit Panel')
  })

  it('emits close event when cancel is clicked', async () => {
    const wrapper = mount(PanelEditModal, {
      props: { dashboardId }
    })
    await wrapper.findAll('button').find(b => b.text() === 'Cancel')?.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('shows error when title is empty', async () => {
    const wrapper = mount(PanelEditModal, {
      props: { dashboardId }
    })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Title is required')
  })

  it('saves panel with PromQL query from QueryEditor', async () => {
    vi.mocked(api.createPanel).mockResolvedValue({
      id: '123',
      dashboard_id: dashboardId,
      title: 'Panel with Query',
      type: 'line_chart',
      grid_pos: { x: 0, y: 0, w: 6, h: 4 },
      query: { promql: 'up' },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    })

    const wrapper = mount(PanelEditModal, {
      props: { dashboardId }
    })
    await wrapper.find('input#title').setValue('Panel with Query')

    // Simulate QueryEditor emitting an update
    const queryEditor = wrapper.findComponent({ name: 'QueryEditor' })
    await queryEditor.vm.$emit('update:modelValue', 'up')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.createPanel).toHaveBeenCalledWith(dashboardId, {
      title: 'Panel with Query',
      type: 'line_chart',
      grid_pos: { x: 0, y: 0, w: 6, h: 4 },
      query: { promql: 'up' }
    })
  })

  it('calls createPanel API on submit when creating', async () => {
    vi.mocked(api.createPanel).mockResolvedValue({
      id: '123',
      dashboard_id: dashboardId,
      title: 'New Panel',
      type: 'line_chart',
      grid_pos: { x: 0, y: 0, w: 6, h: 4 },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    })

    const wrapper = mount(PanelEditModal, {
      props: { dashboardId }
    })
    await wrapper.find('input#title').setValue('New Panel')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.createPanel).toHaveBeenCalledWith(dashboardId, {
      title: 'New Panel',
      type: 'line_chart',
      grid_pos: { x: 0, y: 0, w: 6, h: 4 },
      query: undefined
    })
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('calls updatePanel API on submit when editing', async () => {
    const existingPanel = {
      id: '1',
      dashboard_id: dashboardId,
      title: 'Existing Panel',
      type: 'line_chart',
      grid_pos: { x: 0, y: 0, w: 6, h: 4 },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    vi.mocked(api.updatePanel).mockResolvedValue({
      ...existingPanel,
      title: 'Updated Panel'
    })

    const wrapper = mount(PanelEditModal, {
      props: { dashboardId, panel: existingPanel }
    })
    await wrapper.find('input#title').setValue('Updated Panel')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.updatePanel).toHaveBeenCalledWith('1', {
      title: 'Updated Panel',
      type: 'line_chart',
      query: undefined
    })
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('shows error on API failure', async () => {
    vi.mocked(api.createPanel).mockRejectedValue(new Error('Network error'))

    const wrapper = mount(PanelEditModal, {
      props: { dashboardId }
    })
    await wrapper.find('input#title').setValue('New Panel')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to create panel')
  })
})

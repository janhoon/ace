import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Panel from './Panel.vue'

describe('Panel', () => {
  const mockPanel = {
    id: '1',
    dashboard_id: 'dashboard-1',
    title: 'Test Panel',
    type: 'line_chart',
    grid_pos: { x: 0, y: 0, w: 6, h: 4 },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  it('renders panel title', () => {
    const wrapper = mount(Panel, {
      props: { panel: mockPanel }
    })
    expect(wrapper.find('.panel-title').text()).toBe('Test Panel')
  })

  it('displays panel type', () => {
    const wrapper = mount(Panel, {
      props: { panel: mockPanel }
    })
    expect(wrapper.find('.panel-type').text()).toBe('line_chart')
  })

  it('emits edit event when edit button is clicked', async () => {
    const wrapper = mount(Panel, {
      props: { panel: mockPanel }
    })
    await wrapper.findAll('button').find(b => b.text() === 'Edit')?.trigger('click')
    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')![0]).toEqual([mockPanel])
  })

  it('emits delete event when delete button is clicked', async () => {
    const wrapper = mount(Panel, {
      props: { panel: mockPanel }
    })
    await wrapper.findAll('button').find(b => b.text() === 'X')?.trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')![0]).toEqual([mockPanel])
  })

  it('renders slot content when provided', () => {
    const wrapper = mount(Panel, {
      props: { panel: mockPanel },
      slots: {
        default: '<div class="custom-content">Custom Content</div>'
      }
    })
    expect(wrapper.find('.custom-content').exists()).toBe(true)
    expect(wrapper.find('.custom-content').text()).toBe('Custom Content')
  })
})

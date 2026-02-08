import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LogViewer from './LogViewer.vue'

describe('LogViewer', () => {
  it('renders empty state when logs are missing', () => {
    const wrapper = mount(LogViewer, {
      props: {
        logs: [],
      },
    })

    expect(wrapper.find('.empty-row').exists()).toBe(true)
    expect(wrapper.text()).toContain('No log entries')
  })

  it('expands a row and shows detected JSON fields', async () => {
    const wrapper = mount(LogViewer, {
      props: {
        logs: [
          {
            timestamp: '2026-01-01T12:00:00Z',
            line: '{"message":"request failed","code":500,"meta":{"service":"api"}}',
            labels: { source: 'docker' },
            level: 'error',
          },
        ],
      },
    })

    await wrapper.find('.log-row').trigger('click')

    expect(wrapper.find('.details-row').exists()).toBe(true)
    expect(wrapper.text()).toContain('Detected Fields')
    expect(wrapper.text()).toContain('message')
    expect(wrapper.text()).toContain('request failed')
    expect(wrapper.text()).toContain('meta.service')
    expect(wrapper.text()).toContain('api')
  })

  it('collapses expanded row when clicked again', async () => {
    const wrapper = mount(LogViewer, {
      props: {
        logs: [
          {
            timestamp: '2026-01-01T12:00:00Z',
            line: '{"status":"ok"}',
            labels: {},
            level: 'info',
          },
        ],
      },
    })

    const row = wrapper.find('.log-row')
    await row.trigger('click')
    expect(wrapper.find('.details-row').exists()).toBe(true)

    await row.trigger('click')
    expect(wrapper.find('.details-row').exists()).toBe(false)
  })

  it('detects key-value fields in plain text logs', async () => {
    const wrapper = mount(LogViewer, {
      props: {
        logs: [
          {
            timestamp: '2026-01-01T12:00:00Z',
            line: 'level=error service=worker retry=3 msg="job failed"',
            labels: { stream: 'stderr' },
            level: 'error',
          },
        ],
      },
    })

    await wrapper.find('.log-row').trigger('click')

    expect(wrapper.text()).toContain('service')
    expect(wrapper.text()).toContain('worker')
    expect(wrapper.text()).toContain('retry')
    expect(wrapper.text()).toContain('3')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TraceSpanDetailsPanel from './TraceSpanDetailsPanel.vue'
import type { Trace, TraceSpan } from '../types/datasource'

function makeTrace(): Trace {
  return {
    traceId: 'trace-abc-123',
    startTimeUnixNano: 1_700_000_000_000_000_000,
    durationNano: 3_000_000,
    services: ['gateway', 'api'],
    spans: [
      {
        spanId: 'span-root',
        operationName: 'GET /api/orders',
        serviceName: 'gateway',
        startTimeUnixNano: 1_700_000_000_000_000_000,
        durationNano: 2_400_000,
        status: 'ok',
      },
      {
        spanId: 'span-child',
        parentSpanId: 'span-root',
        operationName: 'SELECT orders',
        serviceName: 'api',
        startTimeUnixNano: 1_700_000_000_000_300_000,
        durationNano: 1_100_000,
        status: 'error',
        tags: {
          db: 'postgres',
          'otel.status_code': 'ERROR',
        },
        logs: [
          {
            timestampUnixNano: 1_700_000_000_000_600_000,
            fields: {
              event: 'db.query',
              rows: '3',
            },
          },
        ],
      },
    ],
  }
}

describe('TraceSpanDetailsPanel', () => {
  const clipboardWrite = vi.fn<() => Promise<void>>()
  const createObjectURL = vi.fn(() => 'blob:test-url')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    clipboardWrite.mockReset()
    clipboardWrite.mockResolvedValue(undefined)
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()

    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        writeText: clipboardWrite,
      },
      configurable: true,
    })

    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    })

    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    })
  })

  it('renders operation, timing, attributes, logs, and error status', () => {
    const trace = makeTrace()
    const selectedSpan = trace.spans.find((span) => span.spanId === 'span-child') as TraceSpan

    const wrapper = mount(TraceSpanDetailsPanel, {
      props: {
        trace,
        span: selectedSpan,
      },
    })

    expect(wrapper.find('.trace-span-details').exists()).toBe(true)
    expect(wrapper.text()).toContain('Span details')
    expect(wrapper.text()).toContain('SELECT orders')
    expect(wrapper.text()).toContain('Error')
    expect(wrapper.text()).toContain('Duration')
    expect(wrapper.text()).toContain('Attributes')
    expect(wrapper.text()).toContain('otel.status_code')
    expect(wrapper.text()).toContain('Logs and events')
    expect(wrapper.text()).toContain('db.query')
  })

  it('emits select-span when clicking parent and child relation links', async () => {
    const trace = makeTrace()
    const child = trace.spans.find((span) => span.spanId === 'span-child') as TraceSpan

    const childWrapper = mount(TraceSpanDetailsPanel, {
      props: {
        trace,
        span: child,
      },
    })

    await childWrapper.find('.relation-link').trigger('click')
    const parentEmit = childWrapper.emitted('select-span')
    expect(parentEmit).toBeTruthy()
    expect(parentEmit?.[0]?.[0]).toMatchObject({ spanId: 'span-root' })

    const root = trace.spans.find((span) => span.spanId === 'span-root') as TraceSpan
    const rootWrapper = mount(TraceSpanDetailsPanel, {
      props: {
        trace,
        span: root,
      },
    })

    await rootWrapper.find('.child-link-list .relation-link').trigger('click')
    const childEmit = rootWrapper.emitted('select-span')
    expect(childEmit).toBeTruthy()
    expect(childEmit?.[0]?.[0]).toMatchObject({ spanId: 'span-child' })
  })

  it('copies IDs and exports span JSON', async () => {
    const trace = makeTrace()
    const span = trace.spans.find((entry) => entry.spanId === 'span-child') as TraceSpan

    const wrapper = mount(TraceSpanDetailsPanel, {
      props: {
        trace,
        span,
      },
    })

    const actionButtons = wrapper.findAll('.action-button')
    await actionButtons[0].trigger('click')
    await actionButtons[1].trigger('click')

    expect(clipboardWrite).toHaveBeenNthCalledWith(1, 'span-child')
    expect(clipboardWrite).toHaveBeenNthCalledWith(2, 'trace-abc-123')

    await actionButtons[2].trigger('click')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})

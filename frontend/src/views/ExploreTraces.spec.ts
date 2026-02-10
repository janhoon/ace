import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ExploreTraces from './ExploreTraces.vue'

const mockFetchDatasources = vi.hoisted(() => vi.fn())
const mockSearchDataSourceTraces = vi.hoisted(() => vi.fn())
const mockFetchDataSourceTrace = vi.hoisted(() => vi.fn())
const mockFetchDataSourceTraceServices = vi.hoisted(() => vi.fn())
const mockFetchDataSourceTraceServiceGraph = vi.hoisted(() => vi.fn())
const mockRouterPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}))

vi.mock('../components/TimeRangePicker.vue', () => ({
  default: {
    name: 'TimeRangePicker',
    template: '<div class="mock-time-range-picker">TimeRangePicker Mock</div>',
  },
}))

vi.mock('../components/TraceTimeline.vue', () => ({
  default: {
    name: 'TraceTimeline',
    props: ['trace', 'selectedSpanId'],
    template: `
      <div class="mock-trace-timeline">
        TraceTimeline Mock
        <button
          v-if="trace.spans.length > 0"
          class="mock-select-span"
          type="button"
          @click="$emit('select-span', trace.spans[0])"
        >
          Select span
        </button>
      </div>
    `,
  },
}))

vi.mock('../components/TraceServiceGraph.vue', () => ({
  default: {
    name: 'TraceServiceGraph',
    props: ['graph'],
    template: `
      <div class="mock-trace-service-graph">
        TraceServiceGraph Mock
        <button
          class="mock-select-service"
          type="button"
          @click="$emit('select-service', graph.nodes[0]?.serviceName || 'api')"
        >
          Select service
        </button>
      </div>
    `,
  },
}))

vi.mock('../composables/useTimeRange', () => ({
  useTimeRange: () => ({
    timeRange: {
      value: {
        start: 1_700_000_000_000,
        end: 1_700_003_600_000,
      },
    },
  }),
}))

vi.mock('../composables/useOrganization', async () => {
  const { ref } = await import('vue')
  return {
    useOrganization: () => ({
      currentOrg: ref({ id: 'org-1', name: 'Test Org', role: 'admin' }),
    }),
  }
})

vi.mock('../composables/useDatasource', async () => {
  const { ref } = await import('vue')

  const tracingDatasources = ref([
    {
      id: 'ds-trace-1',
      organization_id: 'org-1',
      name: 'Tempo Main',
      type: 'tempo',
      url: 'http://localhost:3200',
      is_default: true,
      auth_type: 'none',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ])

  return {
    useDatasource: () => ({
      tracingDatasources,
      fetchDatasources: mockFetchDatasources,
    }),
  }
})

vi.mock('../api/datasources', () => ({
  searchDataSourceTraces: mockSearchDataSourceTraces,
  fetchDataSourceTrace: mockFetchDataSourceTrace,
  fetchDataSourceTraceServices: mockFetchDataSourceTraceServices,
  fetchDataSourceTraceServiceGraph: mockFetchDataSourceTraceServiceGraph,
}))

describe('ExploreTraces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockFetchDatasources.mockResolvedValue(undefined)
    mockFetchDataSourceTraceServices.mockResolvedValue(['api', 'worker'])
    mockSearchDataSourceTraces.mockResolvedValue([])
    mockFetchDataSourceTrace.mockResolvedValue({
      traceId: 'trace-1',
      spans: [],
      services: ['api'],
      startTimeUnixNano: 1_700_000_000_000_000_000,
      durationNano: 1_500_000,
    })
    mockFetchDataSourceTraceServiceGraph.mockResolvedValue({
      nodes: [
        {
          serviceName: 'api',
          requestCount: 2,
          errorCount: 0,
          errorRate: 0,
          averageDurationNano: 1_200_000,
        },
      ],
      edges: [],
      totalRequests: 2,
      totalErrorCount: 0,
    })
  })

  it('renders tracing explore page and datasource selector', async () => {
    const wrapper = mount(ExploreTraces)
    await flushPromises()

    expect(wrapper.find('.explore-header h1').text()).toBe('Explore')
    expect(wrapper.find('.mode-badge').text()).toBe('Tracing')
    expect(wrapper.find('.active-datasource-name').text()).toContain('Tempo Main')
    expect(wrapper.find('.active-datasource-logo').attributes('alt')).toContain('Tempo logo')
    expect(wrapper.find('.mock-time-range-picker').exists()).toBe(true)
    expect(mockFetchDatasources).toHaveBeenCalledWith('org-1')
    expect(mockFetchDataSourceTraceServices).toHaveBeenCalledWith('ds-trace-1')
  })

  it('searches traces and renders results', async () => {
    mockSearchDataSourceTraces.mockResolvedValue([
      {
        traceId: 'trace-abc',
        rootServiceName: 'api',
        rootOperationName: 'GET /health',
        startTimeUnixNano: 1_700_000_000_000_000_000,
        durationNano: 1_500_000,
        spanCount: 5,
        serviceCount: 2,
        errorSpanCount: 0,
      },
    ])

    const wrapper = mount(ExploreTraces)
    await wrapper.find('#trace-search-query').setValue('service=api')

    await wrapper.find('.btn-search').trigger('click')
    await flushPromises()

    expect(mockSearchDataSourceTraces).toHaveBeenCalledWith(
      'ds-trace-1',
      expect.objectContaining({
        query: 'service=api',
        start: 1_700_000_000,
        end: 1_700_003_600,
        limit: 20,
      }),
    )
    expect(wrapper.findAll('.trace-result-row')).toHaveLength(1)
    expect(wrapper.find('.trace-result-row').text()).toContain('trace-abc')
  })

  it('loads trace details and renders timeline after selecting a trace', async () => {
    mockSearchDataSourceTraces.mockResolvedValue([
      {
        traceId: 'trace-abc',
        rootServiceName: 'api',
        rootOperationName: 'GET /health',
        startTimeUnixNano: 1_700_000_000_000_000_000,
        durationNano: 1_500_000,
        spanCount: 5,
        serviceCount: 2,
        errorSpanCount: 0,
      },
    ])
    mockFetchDataSourceTrace.mockResolvedValue({
      traceId: 'trace-abc',
      spans: [
        {
          spanId: 'span-1',
          operationName: 'GET /health',
          serviceName: 'api',
          startTimeUnixNano: 1_700_000_000_000_000_000,
          durationNano: 1_500_000,
          tags: {
            'http.method': 'GET',
          },
          logs: [
            {
              timestampUnixNano: 1_700_000_000_000_100_000,
              fields: {
                event: 'request.received',
              },
            },
          ],
        },
      ],
      services: ['api'],
      startTimeUnixNano: 1_700_000_000_000_000_000,
      durationNano: 1_500_000,
    })

    const wrapper = mount(ExploreTraces)
    await wrapper.find('.btn-search').trigger('click')
    await flushPromises()

    await wrapper.find('.trace-result-row').trigger('click')
    await flushPromises()

    expect(mockFetchDataSourceTrace).toHaveBeenCalledWith('ds-trace-1', 'trace-abc')
    expect(mockFetchDataSourceTraceServiceGraph).toHaveBeenCalledWith('ds-trace-1', 'trace-abc')
    expect(wrapper.find('.mock-trace-timeline').exists()).toBe(true)
    expect(wrapper.find('.mock-trace-service-graph').exists()).toBe(true)

    await wrapper.find('.mock-select-span').trigger('click')
    await flushPromises()

    expect(wrapper.find('.trace-span-details').exists()).toBe(true)
    expect(wrapper.find('.trace-span-details').text()).toContain('Span details')
    expect(wrapper.find('.trace-span-details').text()).toContain('GET /health')
  })

  it('shows service graph fetch error without breaking trace view', async () => {
    mockSearchDataSourceTraces.mockResolvedValue([
      {
        traceId: 'trace-abc',
        rootServiceName: 'api',
        rootOperationName: 'GET /health',
        startTimeUnixNano: 1_700_000_000_000_000_000,
        durationNano: 1_500_000,
        spanCount: 5,
        serviceCount: 2,
        errorSpanCount: 0,
      },
    ])
    mockFetchDataSourceTraceServiceGraph.mockRejectedValue(new Error('graph fetch failed'))

    const wrapper = mount(ExploreTraces)
    await wrapper.find('.btn-search').trigger('click')
    await flushPromises()

    await wrapper.find('.trace-result-row').trigger('click')
    await flushPromises()

    expect(wrapper.find('.service-graph-error').exists()).toBe(true)
    expect(wrapper.find('.service-graph-error').text()).toContain('graph fetch failed')
    expect(wrapper.find('.mock-trace-timeline').exists()).toBe(true)
  })

  it('filters traces when selecting a service from graph', async () => {
    mockSearchDataSourceTraces
      .mockResolvedValueOnce([
        {
          traceId: 'trace-abc',
          rootServiceName: 'api',
          rootOperationName: 'GET /health',
          startTimeUnixNano: 1_700_000_000_000_000_000,
          durationNano: 1_500_000,
          spanCount: 5,
          serviceCount: 2,
          errorSpanCount: 0,
        },
      ])
      .mockResolvedValue([])

    mockFetchDataSourceTraceServiceGraph.mockResolvedValue({
      nodes: [
        {
          serviceName: 'api',
          requestCount: 3,
          errorCount: 0,
          errorRate: 0,
          averageDurationNano: 1_000_000,
        },
      ],
      edges: [],
      totalRequests: 3,
      totalErrorCount: 0,
    })

    const wrapper = mount(ExploreTraces)
    await wrapper.find('.btn-search').trigger('click')
    await flushPromises()

    await wrapper.find('.trace-result-row').trigger('click')
    await flushPromises()

    await wrapper.find('.mock-select-service').trigger('click')
    await flushPromises()

    expect(mockSearchDataSourceTraces).toHaveBeenLastCalledWith(
      'ds-trace-1',
      expect.objectContaining({ service: 'api' }),
    )
  })

  it('shows an error when trace search fails', async () => {
    mockSearchDataSourceTraces.mockRejectedValue(new Error('search failed'))

    const wrapper = mount(ExploreTraces)
    await wrapper.find('.btn-search').trigger('click')
    await flushPromises()

    expect(wrapper.find('.query-error').exists()).toBe(true)
    expect(wrapper.find('.query-error').text()).toContain('search failed')
  })

  it('auto-loads trace from dashboard navigation context', async () => {
    localStorage.setItem('dashboard_trace_navigation', JSON.stringify({
      datasourceId: 'ds-trace-1',
      traceId: 'trace-from-dashboard',
      createdAt: Date.now(),
    }))

    const wrapper = mount(ExploreTraces)
    await flushPromises()

    expect(mockFetchDataSourceTrace).toHaveBeenCalledWith('ds-trace-1', 'trace-from-dashboard')
    expect(mockFetchDataSourceTraceServiceGraph).toHaveBeenCalledWith('ds-trace-1', 'trace-from-dashboard')
    expect((wrapper.get('#trace-id-input').element as HTMLInputElement).value).toBe('trace-from-dashboard')
    expect(localStorage.getItem('dashboard_trace_navigation')).toBeNull()
  })

  it('navigates to Explore Logs with selected span trace context', async () => {
    mockSearchDataSourceTraces.mockResolvedValue([
      {
        traceId: 'trace-abc',
        rootServiceName: 'api',
        rootOperationName: 'GET /health',
        startTimeUnixNano: 1_700_000_000_000_000_000,
        durationNano: 1_500_000,
        spanCount: 5,
        serviceCount: 2,
        errorSpanCount: 0,
      },
    ])
    mockFetchDataSourceTrace.mockResolvedValue({
      traceId: 'trace-abc',
      spans: [
        {
          spanId: 'span-1',
          operationName: 'GET /health',
          serviceName: 'api',
          startTimeUnixNano: 1_700_000_000_000_000_000,
          durationNano: 1_500_000,
        },
      ],
      services: ['api'],
      startTimeUnixNano: 1_700_000_000_000_000_000,
      durationNano: 1_500_000,
    })

    const wrapper = mount(ExploreTraces)
    await wrapper.find('.btn-search').trigger('click')
    await flushPromises()

    await wrapper.find('.trace-result-row').trigger('click')
    await flushPromises()

    await wrapper.find('.mock-select-span').trigger('click')
    await flushPromises()

    const logsButton = wrapper
      .findAll('.action-button')
      .find((button) => button.text() === 'View Logs')
    expect(logsButton).toBeTruthy()

    await logsButton!.trigger('click')

    expect(mockRouterPush).toHaveBeenCalledWith('/explore/logs')
    expect(JSON.parse(localStorage.getItem('trace_logs_navigation') || '{}')).toMatchObject({
      traceId: 'trace-abc',
      serviceName: 'api',
    })
  })

  it('navigates to Explore Metrics with selected span service context', async () => {
    mockSearchDataSourceTraces.mockResolvedValue([
      {
        traceId: 'trace-abc',
        rootServiceName: 'api',
        rootOperationName: 'GET /health',
        startTimeUnixNano: 1_700_000_000_000_000_000,
        durationNano: 1_500_000,
        spanCount: 5,
        serviceCount: 2,
        errorSpanCount: 0,
      },
    ])
    mockFetchDataSourceTrace.mockResolvedValue({
      traceId: 'trace-abc',
      spans: [
        {
          spanId: 'span-1',
          operationName: 'GET /health',
          serviceName: 'api',
          startTimeUnixNano: 1_700_000_000_000_000_000,
          durationNano: 1_500_000,
        },
      ],
      services: ['api'],
      startTimeUnixNano: 1_700_000_000_000_000_000,
      durationNano: 1_500_000,
    })

    const wrapper = mount(ExploreTraces)
    await wrapper.find('.btn-search').trigger('click')
    await flushPromises()

    await wrapper.find('.trace-result-row').trigger('click')
    await flushPromises()

    await wrapper.find('.mock-select-span').trigger('click')
    await flushPromises()

    const metricsButton = wrapper
      .findAll('.action-button')
      .find((button) => button.text() === 'View Service Metrics')
    expect(metricsButton).toBeTruthy()

    await metricsButton!.trigger('click')

    expect(mockRouterPush).toHaveBeenCalledWith('/explore/metrics')
    expect(JSON.parse(localStorage.getItem('trace_metrics_navigation') || '{}')).toMatchObject({
      serviceName: 'api',
    })
  })
})

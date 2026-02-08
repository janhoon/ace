import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Explore from './Explore.vue'

const mockFetchDatasources = vi.hoisted(() => vi.fn())
const mockQueryDataSource = vi.hoisted(() => vi.fn())

vi.mock('../components/TimeRangePicker.vue', () => ({
  default: {
    name: 'TimeRangePicker',
    template: '<div class="mock-time-range-picker">TimeRangePicker Mock</div>'
  }
}))

vi.mock('../components/LineChart.vue', () => ({
  default: {
    name: 'LineChart',
    props: ['series', 'height'],
    template: '<div class="mock-line-chart">LineChart Mock</div>'
  }
}))

vi.mock('../components/QueryBuilder.vue', () => ({
  default: {
    name: 'QueryBuilder',
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    template: `
      <textarea
        id="promql-query-input"
        :value="modelValue"
        :disabled="disabled"
        @input="$emit('update:modelValue', $event.target.value)"
      ></textarea>
    `
  }
}))

vi.mock('../composables/useTimeRange', () => ({
  useTimeRange: () => ({
    timeRange: { value: { start: Date.now() - 3600000, end: Date.now() } },
    onRefresh: vi.fn(() => () => {}),
  })
}))

vi.mock('../composables/useOrganization', async () => {
  const { ref } = await import('vue')
  return {
    useOrganization: () => ({
      currentOrg: ref({ id: 'org-1', name: 'Test Org', role: 'admin' })
    })
  }
})

vi.mock('../composables/useDatasource', async () => {
  const { ref } = await import('vue')

  const metricsDatasources = ref([
    {
      id: 'ds-1',
      organization_id: 'org-1',
      name: 'Prometheus Main',
      type: 'prometheus',
      url: 'http://localhost:9090',
      is_default: true,
      auth_type: 'none',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ])

  return {
    useDatasource: () => ({
      metricsDatasources,
      fetchDatasources: mockFetchDatasources,
    })
  }
})

vi.mock('../api/datasources', () => ({
  queryDataSource: mockQueryDataSource,
}))

vi.mock('../composables/useProm', () => ({
  transformToChartData: vi.fn(),
  fetchMetrics: vi.fn().mockResolvedValue([]),
  fetchLabels: vi.fn().mockResolvedValue([]),
  fetchLabelValues: vi.fn().mockResolvedValue([]),
}))

import { transformToChartData } from '../composables/useProm'

describe('Explore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockFetchDatasources.mockResolvedValue(undefined)
    mockQueryDataSource.mockResolvedValue({
      status: 'success',
      resultType: 'metrics',
      data: {
        resultType: 'matrix',
        result: [],
      },
    })
  })

  it('renders metrics explore page and card selector', async () => {
    const wrapper = mount(Explore)
    await flushPromises()

    expect(wrapper.find('.explore-header h1').text()).toBe('Explore')
    expect(wrapper.find('.mode-badge').text()).toBe('Metrics')
    expect(wrapper.find('.active-datasource-panel').exists()).toBe(true)
    expect(wrapper.find('.active-datasource-name').text()).toContain('Prometheus Main')
    expect(wrapper.find('.active-datasource-logo').attributes('alt')).toContain('Prometheus logo')
    expect(wrapper.find('.source-health-badge').text()).toContain('Healthy')
    expect(wrapper.find('.datasource-selector').exists()).toBe(true)
    expect(wrapper.find('.mock-time-range-picker').exists()).toBe(true)

    await wrapper.find('.datasource-trigger').trigger('click')
    expect(wrapper.find('.datasource-dropdown').exists()).toBe(true)
    expect(wrapper.find('.datasource-option').text()).toContain('Prometheus Main')

    expect(mockFetchDatasources).toHaveBeenCalledWith('org-1')
  })

  it('disables Run Query button when query is empty', () => {
    const wrapper = mount(Explore)
    const runButton = wrapper.find('.btn-run')

    expect(runButton.attributes('disabled')).toBeDefined()
  })

  it('enables Run Query button when query is entered', async () => {
    const wrapper = mount(Explore)
    await wrapper.find('#promql-query-input').setValue('up')

    const runButton = wrapper.find('.btn-run')
    expect(runButton.attributes('disabled')).toBeUndefined()
  })

  it('executes metrics query with selected datasource', async () => {
    mockQueryDataSource.mockResolvedValue({
      status: 'success',
      resultType: 'metrics',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'up' },
            values: [[1609459200, '1']]
          }
        ]
      },
    })

    vi.mocked(transformToChartData).mockReturnValue({
      series: [{
        name: 'up',
        data: [{ timestamp: 1609459200, value: 1 }],
        labels: { __name__: 'up' }
      }]
    })

    const wrapper = mount(Explore)
    await wrapper.find('#promql-query-input').setValue('up')

    await wrapper.find('.btn-run').trigger('click')
    await flushPromises()

    expect(mockQueryDataSource).toHaveBeenCalledWith(
      'ds-1',
      expect.objectContaining({
        query: 'up',
      })
    )
    expect(wrapper.find('.mock-line-chart').exists()).toBe(true)
    expect(wrapper.find('.result-count').text()).toContain('1 series')
  })

  it('shows error message when query response fails', async () => {
    mockQueryDataSource.mockResolvedValue({
      status: 'error',
      resultType: 'metrics',
      error: 'invalid query',
    })

    const wrapper = mount(Explore)
    await wrapper.find('#promql-query-input').setValue('invalid{')

    await wrapper.find('.btn-run').trigger('click')
    await flushPromises()

    expect(wrapper.find('.query-error').exists()).toBe(true)
    expect(wrapper.find('.query-error').text()).toContain('invalid query')
  })

  it('stores successful queries in session history', async () => {
    mockQueryDataSource.mockResolvedValue({
      status: 'success',
      resultType: 'metrics',
      data: {
        resultType: 'matrix',
        result: []
      },
    })

    vi.mocked(transformToChartData).mockReturnValue({ series: [] })

    const wrapper = mount(Explore)
    await wrapper.find('#promql-query-input').setValue('up')

    await wrapper.find('.btn-run').trigger('click')
    await flushPromises()

    const history = JSON.parse(sessionStorage.getItem('explore_query_history') || '[]')
    expect(history).toContain('up')
  })
})

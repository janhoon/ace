import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import {
  useProm,
  queryPrometheus,
  transformToChartData,
  type PrometheusQueryResult,
  type ChartData
} from './useProm'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('transformToChartData', () => {
  it('returns empty series for error status', () => {
    const result: PrometheusQueryResult = {
      status: 'error',
      error: 'some error'
    }

    const chartData = transformToChartData(result)
    expect(chartData.series).toEqual([])
  })

  it('returns empty series when data is undefined', () => {
    const result: PrometheusQueryResult = {
      status: 'success'
    }

    const chartData = transformToChartData(result)
    expect(chartData.series).toEqual([])
  })

  it('transforms single metric result correctly', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'up', instance: 'localhost:9090', job: 'prometheus' },
            values: [
              [1704067200, '1'],
              [1704067215, '1']
            ]
          }
        ]
      }
    }

    const chartData = transformToChartData(result)

    expect(chartData.series).toHaveLength(1)
    expect(chartData.series[0].name).toBe('up{instance="localhost:9090",job="prometheus"}')
    expect(chartData.series[0].data).toEqual([
      { timestamp: 1704067200, value: 1 },
      { timestamp: 1704067215, value: 1 }
    ])
    expect(chartData.series[0].labels).toEqual({
      __name__: 'up',
      instance: 'localhost:9090',
      job: 'prometheus'
    })
  })

  it('transforms multiple metric results correctly', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'up', job: 'prometheus' },
            values: [[1704067200, '1']]
          },
          {
            metric: { __name__: 'up', job: 'node' },
            values: [[1704067200, '0']]
          }
        ]
      }
    }

    const chartData = transformToChartData(result)

    expect(chartData.series).toHaveLength(2)
    expect(chartData.series[0].name).toBe('up{job="prometheus"}')
    expect(chartData.series[1].name).toBe('up{job="node"}')
  })

  it('handles metric without __name__', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { instance: 'localhost:9090' },
            values: [[1704067200, '42']]
          }
        ]
      }
    }

    const chartData = transformToChartData(result)

    expect(chartData.series[0].name).toBe('value{instance="localhost:9090"}')
  })

  it('handles metric without any labels', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'scalar_value' },
            values: [[1704067200, '100']]
          }
        ]
      }
    }

    const chartData = transformToChartData(result)

    expect(chartData.series[0].name).toBe('scalar_value')
  })

  it('parses string values to numbers correctly', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'test' },
            values: [
              [1704067200, '3.14159'],
              [1704067215, '-42.5'],
              [1704067230, '0']
            ]
          }
        ]
      }
    }

    const chartData = transformToChartData(result)

    expect(chartData.series[0].data).toEqual([
      { timestamp: 1704067200, value: Number('3.14159') },
      { timestamp: 1704067215, value: -42.5 },
      { timestamp: 1704067230, value: 0 }
    ])
  })
})

describe('queryPrometheus', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('constructs correct URL with query parameters', async () => {
    const mockResponse: PrometheusQueryResult = {
      status: 'success',
      data: { resultType: 'matrix', result: [] }
    }
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    })

    await queryPrometheus('up', 1704067200, 1704070800, 15)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/api/datasources/prometheus/query')
    expect(calledUrl).toContain('query=up')
    expect(calledUrl).toContain('start=1704067200')
    expect(calledUrl).toContain('end=1704070800')
    expect(calledUrl).toContain('step=15')
  })

  it('returns the response data', async () => {
    const mockResponse: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'up' },
            values: [[1704067200, '1']]
          }
        ]
      }
    }
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    })

    const result = await queryPrometheus('up', 1704067200, 1704070800, 15)

    expect(result).toEqual(mockResponse)
  })

  it('floors timestamp values', async () => {
    const mockResponse: PrometheusQueryResult = {
      status: 'success',
      data: { resultType: 'matrix', result: [] }
    }
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    })

    await queryPrometheus('up', 1704067200.5, 1704070800.9, 15)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('start=1704067200')
    expect(calledUrl).toContain('end=1704070800')
  })
})

describe('useProm', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with correct default values', () => {
    const { data, chartData, loading, error } = useProm({
      query: ref(''),
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: false
    })

    expect(data.value).toBeNull()
    expect(chartData.value).toEqual({ series: [] })
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('sets error when query is empty', async () => {
    const { error, fetch } = useProm({
      query: ref(''),
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: false
    })

    await fetch()

    expect(error.value).toBe('Query is required')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sets loading state during fetch', async () => {
    let resolvePromise: ((value: PrometheusQueryResult) => void) | undefined
    const pendingPromise = new Promise<PrometheusQueryResult>((resolve) => {
      resolvePromise = resolve
    })

    mockFetch.mockReturnValueOnce({
      json: () => pendingPromise
    })

    const { loading, fetch } = useProm({
      query: ref('up'),
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: false
    })

    expect(loading.value).toBe(false)

    const fetchPromise = fetch()
    await nextTick()

    expect(loading.value).toBe(true)

    resolvePromise?.({ status: 'success', data: { resultType: 'matrix', result: [] } })
    await fetchPromise
    await nextTick()

    expect(loading.value).toBe(false)
  })

  it('fetches and transforms data successfully', async () => {
    const mockResponse: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'up', job: 'prometheus' },
            values: [
              [1704067200, '1'],
              [1704067215, '1']
            ]
          }
        ]
      }
    }

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    })

    const { data, chartData, error, fetch } = useProm({
      query: ref('up'),
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: false
    })

    await fetch()

    expect(error.value).toBeNull()
    expect(data.value).toEqual(mockResponse)
    expect(chartData.value.series).toHaveLength(1)
    expect(chartData.value.series[0].name).toBe('up{job="prometheus"}')
  })

  it('handles error response from API', async () => {
    const mockResponse: PrometheusQueryResult = {
      status: 'error',
      error: 'invalid query'
    }

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    })

    const { data, chartData, error, fetch } = useProm({
      query: ref('invalid{'),
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: false
    })

    await fetch()

    expect(error.value).toBe('invalid query')
    expect(data.value).toEqual(mockResponse)
    expect(chartData.value.series).toEqual([])
  })

  it('handles network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { data, chartData, error, fetch } = useProm({
      query: ref('up'),
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: false
    })

    await fetch()

    expect(error.value).toBe('Network error')
    expect(data.value).toBeNull()
    expect(chartData.value.series).toEqual([])
  })

  it('uses custom step value when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ status: 'success', data: { resultType: 'matrix', result: [] } })
    })

    const { fetch } = useProm({
      query: ref('up'),
      start: ref(1704067200),
      end: ref(1704070800),
      step: ref(60),
      autoFetch: false
    })

    await fetch()

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('step=60')
  })

  it('uses default step value when not provided', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ status: 'success', data: { resultType: 'matrix', result: [] } })
    })

    const { fetch } = useProm({
      query: ref('up'),
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: false
    })

    await fetch()

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('step=15')
  })

  it('auto-fetches when query changes with autoFetch enabled', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ status: 'success', data: { resultType: 'matrix', result: [] } })
    })

    const query = ref('up')

    useProm({
      query,
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: true
    })

    // Initial fetch on mount
    await nextTick()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Change query and trigger watch
    query.value = 'process_cpu_seconds_total'
    await nextTick()
    await nextTick() // Extra tick for watch callback

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not auto-fetch when autoFetch is false', async () => {
    const query = ref('up')

    useProm({
      query,
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: false
    })

    await nextTick()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not auto-fetch when query is empty', async () => {
    const query = ref('')

    useProm({
      query,
      start: ref(1704067200),
      end: ref(1704070800),
      autoFetch: true
    })

    await nextTick()

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

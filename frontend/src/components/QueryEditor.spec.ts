import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import QueryEditor from './QueryEditor.vue'
import * as useProm from '../composables/useProm'
import type { PrometheusQueryResult } from '../composables/useProm'

// Mock the useProm module
vi.mock('../composables/useProm', () => ({
  queryPrometheus: vi.fn()
}))

describe('QueryEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the query textarea', () => {
    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: ''
      }
    })

    expect(wrapper.find('textarea#promql-query').exists()).toBe(true)
    expect(wrapper.find('button.btn-run').exists()).toBe(true)
  })

  it('displays the current query value', () => {
    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up'
      }
    })

    const textarea = wrapper.find('textarea#promql-query')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('up')
  })

  it('emits update:modelValue when query changes', async () => {
    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: ''
      }
    })

    await wrapper.find('textarea#promql-query').setValue('process_cpu')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['process_cpu'])
  })

  it('disables inputs when disabled prop is true', () => {
    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up',
        disabled: true
      }
    })

    const textarea = wrapper.find('textarea#promql-query')
    const button = wrapper.find('button.btn-run')

    expect((textarea.element as HTMLTextAreaElement).disabled).toBe(true)
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables Run Query button when query is empty', () => {
    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: ''
      }
    })

    const button = wrapper.find('button.btn-run')
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables Run Query button when query has value', () => {
    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up'
      }
    })

    const button = wrapper.find('button.btn-run')
    expect((button.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables Run Query button for whitespace-only query', () => {
    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: '   '
      }
    })

    const button = wrapper.find('button.btn-run')
    // The button should be disabled because query.trim() is empty
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows loading state during query execution', async () => {
    let resolveQuery: ((value: PrometheusQueryResult) => void) | undefined
    const pendingPromise = new Promise<PrometheusQueryResult>((resolve) => {
      resolveQuery = resolve
    })

    vi.mocked(useProm.queryPrometheus).mockReturnValueOnce(pendingPromise)

    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up'
      }
    })

    await wrapper.find('button.btn-run').trigger('click')
    await flushPromises()

    expect(wrapper.find('button.btn-run').text()).toBe('Running...')

    resolveQuery?.({ status: 'success', data: { resultType: 'matrix', result: [] } })
    await flushPromises()

    expect(wrapper.find('button.btn-run').text()).toBe('Run Query')
  })

  it('displays error when query fails', async () => {
    vi.mocked(useProm.queryPrometheus).mockResolvedValueOnce({
      status: 'error',
      error: 'parse error at line 1'
    })

    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'invalid{query'
      }
    })

    await wrapper.find('button.btn-run').trigger('click')
    await flushPromises()

    expect(wrapper.find('.query-error').exists()).toBe(true)
    expect(wrapper.find('.query-error').text()).toBe('parse error at line 1')
  })

  it('displays results preview on successful query', async () => {
    vi.mocked(useProm.queryPrometheus).mockResolvedValueOnce({
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'up', instance: 'localhost:9090', job: 'prometheus' },
            values: [[1704067200, '1'], [1704067215, '1']]
          }
        ]
      }
    })

    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up'
      }
    })

    await wrapper.find('button.btn-run').trigger('click')
    await flushPromises()

    expect(wrapper.find('.query-preview').exists()).toBe(true)
    expect(wrapper.find('.preview-header').text()).toContain('Query Results')
    expect(wrapper.find('.result-count').text()).toBe('1 series')
  })

  it('displays metric labels from query result', async () => {
    vi.mocked(useProm.queryPrometheus).mockResolvedValueOnce({
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'up', instance: 'localhost:9090', job: 'prometheus' },
            values: [[1704067200, '1']]
          }
        ]
      }
    })

    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up'
      }
    })

    await wrapper.find('button.btn-run').trigger('click')
    await flushPromises()

    const labels = wrapper.findAll('.label-tag')
    expect(labels.length).toBeGreaterThan(0)

    const labelTexts = labels.map(l => l.text())
    expect(labelTexts).toContain('__name__')
    expect(labelTexts).toContain('instance')
    expect(labelTexts).toContain('job')
  })

  it('displays preview table with metric data', async () => {
    vi.mocked(useProm.queryPrometheus).mockResolvedValueOnce({
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'up', job: 'prometheus' },
            values: [[1704067200, '1'], [1704067215, '1']]
          },
          {
            metric: { __name__: 'up', job: 'node' },
            values: [[1704067200, '0']]
          }
        ]
      }
    })

    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up'
      }
    })

    await wrapper.find('button.btn-run').trigger('click')
    await flushPromises()

    expect(wrapper.find('.preview-table').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr').length).toBe(2)
    expect(wrapper.find('.result-count').text()).toBe('2 series')
  })

  it('shows no data message when result is empty', async () => {
    vi.mocked(useProm.queryPrometheus).mockResolvedValueOnce({
      status: 'success',
      data: {
        resultType: 'matrix',
        result: []
      }
    })

    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'nonexistent_metric'
      }
    })

    await wrapper.find('button.btn-run').trigger('click')
    await flushPromises()

    expect(wrapper.find('.no-data').exists()).toBe(true)
    expect(wrapper.find('.no-data').text()).toContain('No data returned')
  })

  it('clears results when query changes', async () => {
    vi.mocked(useProm.queryPrometheus).mockResolvedValueOnce({
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
    })

    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up'
      }
    })

    // Run initial query
    await wrapper.find('button.btn-run').trigger('click')
    await flushPromises()

    expect(wrapper.find('.query-preview').exists()).toBe(true)

    // Change the query
    await wrapper.setProps({ modelValue: 'process_cpu' })
    await flushPromises()

    // Results should be cleared
    expect(wrapper.find('.query-preview').exists()).toBe(false)
  })

  it('handles network error gracefully', async () => {
    vi.mocked(useProm.queryPrometheus).mockRejectedValueOnce(new Error('Network error'))

    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up'
      }
    })

    await wrapper.find('button.btn-run').trigger('click')
    await flushPromises()

    expect(wrapper.find('.query-error').exists()).toBe(true)
    expect(wrapper.find('.query-error').text()).toBe('Network error')
  })

  it('calls queryPrometheus with correct parameters', async () => {
    vi.mocked(useProm.queryPrometheus).mockResolvedValueOnce({
      status: 'success',
      data: { resultType: 'matrix', result: [] }
    })

    const wrapper = mount(QueryEditor, {
      props: {
        modelValue: 'up'
      }
    })

    await wrapper.find('button.btn-run').trigger('click')
    await flushPromises()

    expect(useProm.queryPrometheus).toHaveBeenCalledTimes(1)
    const [query, start, end, step] = vi.mocked(useProm.queryPrometheus).mock.calls[0]

    expect(query).toBe('up')
    expect(typeof start).toBe('number')
    expect(typeof end).toBe('number')
    expect(end - start).toBe(3600) // 1 hour range
    expect(step).toBe(15) // 15 second step
  })
})

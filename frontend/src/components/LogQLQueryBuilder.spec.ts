import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LogQLQueryBuilder from './LogQLQueryBuilder.vue'

const mockFetchDataSourceLabelValues = vi.hoisted(() => vi.fn())

vi.mock('./MonacoQueryEditor.vue', () => ({
  default: {
    name: 'MonacoQueryEditor',
    props: ['modelValue'],
    emits: ['update:modelValue', 'submit'],
    template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}))

vi.mock('../api/datasources', () => ({
  fetchDataSourceLabelValues: mockFetchDataSourceLabelValues,
}))

describe('LogQLQueryBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchDataSourceLabelValues.mockResolvedValue(['api', 'worker'])
  })

  it('builds selector query from indexed field, operator, and value dropdowns', async () => {
    const wrapper = mount(LogQLQueryBuilder, {
      props: {
        modelValue: '',
        indexedLabels: ['job', 'service_name'],
        datasourceId: 'ds-1',
      },
    })

    await wrapper.find('.btn-add').trigger('click')
    await wrapper.find('.filter-label-select').setValue('job')
    await flushPromises()

    expect(mockFetchDataSourceLabelValues).toHaveBeenCalledWith('ds-1', 'job')

    await wrapper.find('.filter-value-select').setValue('api')
    await flushPromises()

    const updates = wrapper.emitted('update:modelValue') || []
    expect(updates.at(-1)).toEqual(['{job="api"}'])
  })

  it('appends line filter operator to generated query', async () => {
    const wrapper = mount(LogQLQueryBuilder, {
      props: {
        modelValue: '',
        indexedLabels: ['job'],
        datasourceId: 'ds-1',
      },
    })

    await wrapper.find('.btn-add').trigger('click')
    await wrapper.find('.filter-label-select').setValue('job')
    await flushPromises()
    await wrapper.find('.filter-value-select').setValue('api')

    await wrapper.find('.line-value-input').setValue('error')
    await flushPromises()

    const updates = wrapper.emitted('update:modelValue') || []
    expect(updates.at(-1)).toEqual(['{job="api"} |= "error"'])
  })

  it('builds LogsQL query for Victoria Logs with field and value dropdowns', async () => {
    const wrapper = mount(LogQLQueryBuilder, {
      props: {
        modelValue: '',
        queryLanguage: 'logsql',
        indexedLabels: ['service_name'],
        datasourceId: 'ds-2',
      },
    })

    await wrapper.find('.btn-add').trigger('click')
    await wrapper.find('.filter-label-select').setValue('service_name')
    await flushPromises()
    await wrapper.find('.filter-value-select').setValue('api')
    await flushPromises()

    const updates = wrapper.emitted('update:modelValue') || []
    expect(updates.at(-1)).toEqual(['* "service_name":="api"'])
  })

  it('uses LogsQL text filter operators in builder mode', async () => {
    const wrapper = mount(LogQLQueryBuilder, {
      props: {
        modelValue: '',
        queryLanguage: 'logsql',
        indexedLabels: [],
        datasourceId: 'ds-2',
      },
    })

    await wrapper.find('.line-value-input').setValue('error')
    await flushPromises()

    const updates = wrapper.emitted('update:modelValue') || []
    expect(updates.at(-1)).toEqual(['* "error"'])
  })
})

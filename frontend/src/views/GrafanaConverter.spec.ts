import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import GrafanaConverter from './GrafanaConverter.vue'

const mockConvertGrafanaDashboard = vi.hoisted(() => vi.fn())

vi.mock('../api/converter', () => ({
  convertGrafanaDashboard: mockConvertGrafanaDashboard,
}))

describe('GrafanaConverter', () => {
  it('converts a pasted grafana payload and renders warnings', async () => {
    mockConvertGrafanaDashboard.mockResolvedValueOnce({
      format: 'json',
      content: '{"schema_version":1}',
      document: {
        schema_version: 1,
        dashboard: {
          title: 'Converted dashboard',
          panels: [],
        },
      },
      warnings: ['panel[1] unsupported panel type "heatmap" mapped to line'],
    })

    const wrapper = mount(GrafanaConverter)
    await wrapper.get('[data-testid="grafana-source"]').setValue('{"dashboard":{"title":"x"}}')
    await wrapper.get('[data-testid="convert-button"]').trigger('click')
    await flushPromises()

    expect(mockConvertGrafanaDashboard).toHaveBeenCalledWith('{"dashboard":{"title":"x"}}', 'json')
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('schema_version')
    expect(wrapper.get('[data-testid="convert-warnings"]').text()).toContain('unsupported panel type')
  })

  it('shows API error when conversion fails', async () => {
    mockConvertGrafanaDashboard.mockRejectedValueOnce(new Error('invalid grafana dashboard JSON'))

    const wrapper = mount(GrafanaConverter)
    await wrapper.get('[data-testid="grafana-source"]').setValue('{')
    await wrapper.get('[data-testid="convert-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="convert-error"]').text()).toContain('invalid grafana dashboard JSON')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DashboardSettingsModal from './DashboardSettingsModal.vue'
import * as dashboardApi from '../api/dashboards'
import * as converterApi from '../api/converter'

vi.mock('../api/dashboards')
vi.mock('../api/converter')

const mockDashboard = {
  id: 'dashboard-1',
  title: 'Production Overview',
  description: 'Main production metrics',
  created_at: '2026-02-09T00:00:00Z',
  updated_at: '2026-02-09T00:00:00Z',
}

const mockSettings = {
  timeRangePreset: '1h',
  refreshInterval: 'off',
  variables: [],
}

const initialYaml = `schema_version: 1
dashboard:
  title: Production Overview
  description: Main production metrics
  panels: []
`

describe('DashboardSettingsModal', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:dashboard-export')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(dashboardApi.exportDashboardYaml).mockResolvedValue(
      new Blob([initialYaml], { type: 'application/x-yaml' }),
    )
    vi.mocked(dashboardApi.updateDashboard).mockResolvedValue({
      ...mockDashboard,
      title: mockDashboard.title,
      description: mockDashboard.description,
    })
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('exports dashboard yaml from settings modal', async () => {
    const wrapper = mount(DashboardSettingsModal, {
      props: {
        dashboard: mockDashboard,
        canEdit: true,
        defaultSettings: mockSettings,
      },
    })
    await flushPromises()

    vi.mocked(dashboardApi.exportDashboardYaml).mockClear()

    await wrapper.get('.btn-export').trigger('click')
    await flushPromises()

    expect(dashboardApi.exportDashboardYaml).toHaveBeenCalledWith('dashboard-1')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dashboard-export')
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Dashboard export downloaded')
  })

  it('shows export error message when download fails', async () => {
    vi.mocked(dashboardApi.exportDashboardYaml)
      .mockResolvedValueOnce(new Blob([initialYaml], { type: 'application/x-yaml' }))
      .mockRejectedValueOnce(new Error('Not authorized to export this dashboard'))

    const wrapper = mount(DashboardSettingsModal, {
      props: {
        dashboard: mockDashboard,
        canEdit: false,
        defaultSettings: mockSettings,
      },
    })
    await flushPromises()

    await wrapper.get('.btn-export').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Not authorized to export this dashboard')
  })

  it('shows YAML diff preview when editor content changes', async () => {
    const wrapper = mount(DashboardSettingsModal, {
      props: {
        dashboard: mockDashboard,
        canEdit: true,
        defaultSettings: mockSettings,
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="settings-tab-yaml"]').trigger('click')
    const editor = wrapper.get('[data-testid="yaml-editor-input"]')
    await editor.setValue(initialYaml.replace('Production Overview', 'Updated Overview'))

    const diff = wrapper.get('[data-testid="yaml-diff-preview"]').text()
    expect(diff).toContain('-   title: Production Overview')
    expect(diff).toContain('+   title: Updated Overview')
  })

  it('validates YAML content before saving', async () => {
    const wrapper = mount(DashboardSettingsModal, {
      props: {
        dashboard: mockDashboard,
        canEdit: true,
        defaultSettings: mockSettings,
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="settings-tab-yaml"]').trigger('click')
    await wrapper.get('[data-testid="yaml-editor-input"]').setValue('dashboard:\n  title: Broken\n  panels: []')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(dashboardApi.updateDashboard).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="yaml-validation-error"]').text()).toContain('Missing schema_version')
  })

  it('converts Grafana JSON into YAML editor content', async () => {
    vi.mocked(converterApi.convertGrafanaDashboard).mockResolvedValue({
      format: 'yaml',
      content: `schema_version: 1\ndashboard:\n  title: Converted\n  panels: []\n`,
      document: {
        schema_version: 1,
        dashboard: {
          title: 'Converted',
          panels: [],
        },
      },
      warnings: ['Mapped unsupported query as passthrough'],
    })

    const wrapper = mount(DashboardSettingsModal, {
      props: {
        dashboard: mockDashboard,
        canEdit: true,
        defaultSettings: mockSettings,
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="settings-tab-yaml"]').trigger('click')
    await wrapper.get('[data-testid="grafana-replace-toggle"]').trigger('click')
    await wrapper.get('[data-testid="grafana-source"]').setValue('{"dashboard":{"title":"converted","panels":[]}}')
    await wrapper.get('[data-testid="grafana-replace-convert"]').trigger('click')
    await flushPromises()

    expect(converterApi.convertGrafanaDashboard).toHaveBeenCalledWith(
      '{"dashboard":{"title":"converted","panels":[]}}',
      'yaml',
    )
    expect((wrapper.get('[data-testid="yaml-editor-input"]').element as HTMLTextAreaElement).value).toContain('title: Converted')
    expect(wrapper.get('[data-testid="grafana-warnings"]').text()).toContain('Mapped unsupported query as passthrough')
  })

  it('saves YAML edits and emits updated dashboard settings', async () => {
    const wrapper = mount(DashboardSettingsModal, {
      props: {
        dashboard: mockDashboard,
        canEdit: true,
        defaultSettings: mockSettings,
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="settings-tab-yaml"]').trigger('click')
    await wrapper.get('[data-testid="yaml-editor-input"]').setValue(`schema_version: 1
dashboard:
  title: Ops Runtime
  description: Updated from YAML
  refresh_interval: 30s
  time_range:
    from: now-24h
    to: now
  variables:
    - name: env
      type: custom
    - name: cluster
      type: custom
  panels: []
`)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(dashboardApi.updateDashboard).toHaveBeenCalledWith('dashboard-1', {
      title: 'Ops Runtime',
      description: 'Updated from YAML',
    })

    const savedEvents = wrapper.emitted('saved')
    expect(savedEvents).toBeTruthy()
    const firstPayload = savedEvents?.[0]?.[0] as {
      title: string
      description: string
      settings: {
        timeRangePreset: string
        refreshInterval: string
        variables: string[]
      }
    }
    expect(firstPayload.title).toBe('Ops Runtime')
    expect(firstPayload.description).toBe('Updated from YAML')
    expect(firstPayload.settings.timeRangePreset).toBe('24h')
    expect(firstPayload.settings.refreshInterval).toBe('30s')
    expect(firstPayload.settings.variables).toEqual(['env', 'cluster'])
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DashboardSettingsModal from './DashboardSettingsModal.vue'
import * as dashboardApi from '../api/dashboards'

vi.mock('../api/dashboards')

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

describe('DashboardSettingsModal', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:dashboard-export')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('exports dashboard yaml from settings modal', async () => {
    vi.mocked(dashboardApi.exportDashboardYaml).mockResolvedValue(
      new Blob(['schema_version: 1'], { type: 'application/x-yaml' }),
    )

    const wrapper = mount(DashboardSettingsModal, {
      props: {
        dashboard: mockDashboard,
        canEdit: true,
        defaultSettings: mockSettings,
      },
    })

    await wrapper.get('.btn-export').trigger('click')
    await flushPromises()

    expect(dashboardApi.exportDashboardYaml).toHaveBeenCalledWith('dashboard-1')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dashboard-export')
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Dashboard export downloaded')
  })

  it('shows export error message when download fails', async () => {
    vi.mocked(dashboardApi.exportDashboardYaml).mockRejectedValue(new Error('Not authorized to export this dashboard'))

    const wrapper = mount(DashboardSettingsModal, {
      props: {
        dashboard: mockDashboard,
        canEdit: false,
        defaultSettings: mockSettings,
      },
    })

    await wrapper.get('.btn-export').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Not authorized to export this dashboard')
  })
})

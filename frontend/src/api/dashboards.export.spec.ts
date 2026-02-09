import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportDashboardYaml } from './dashboards'

describe('exportDashboardYaml', () => {
  const mockFetch = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = mockFetch
    mockFetch.mockClear()
    localStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('downloads yaml payload from export endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('schema_version: 1\ndashboard:\n  title: Test\n'),
    })

    const result = await exportDashboardYaml('dashboard-1')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/dashboards/dashboard-1/export?format=yaml',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    )
    expect(result.type).toBe('application/x-yaml')
  })

  it('throws permission error for forbidden response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 })

    await expect(exportDashboardYaml('dashboard-1')).rejects.toThrow('Not authorized to export this dashboard')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { importDashboardYaml } from './dashboards'

describe('importDashboardYaml', () => {
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

  it('imports yaml payload into organization dashboards', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'dashboard-1',
        title: 'Imported Dashboard',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }),
    })

    const yamlPayload = 'schema_version: 1\ndashboard:\n  title: Imported Dashboard\n'
    const result = await importDashboardYaml('org-1', yamlPayload)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/orgs/org-1/dashboards/import?format=yaml',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-yaml',
        }),
        body: yamlPayload,
      }),
    )
    expect(result.title).toBe('Imported Dashboard')
  })

  it('throws validation error for invalid yaml', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400 })

    await expect(importDashboardYaml('org-1', 'not valid')).rejects.toThrow('Invalid YAML dashboard document')
  })
})

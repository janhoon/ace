import { beforeEach, describe, expect, it, vi } from 'vitest'
import { convertGrafanaDashboard } from './converter'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  localStorage.clear()
})

describe('converter API', () => {
  it('converts grafana dashboard payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        format: 'json',
        content: '{"schema_version":1}',
        document: { schema_version: 1, dashboard: { title: 'Converted', panels: [] } },
        warnings: [],
      }),
    })

    const result = await convertGrafanaDashboard('{"dashboard":{"title":"x"}}', 'json')

    expect(result.document.dashboard.title).toBe('Converted')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/convert/grafana?format=json'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('includes auth token when available', async () => {
    localStorage.setItem('access_token', 'token-123')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        format: 'yaml',
        content: 'schema_version: 1',
        document: { schema_version: 1, dashboard: { title: 'Converted', panels: [] } },
        warnings: [],
      }),
    })

    await convertGrafanaDashboard('{"dashboard":{"title":"x"}}', 'yaml')

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-123')
  })
})

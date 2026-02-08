import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getGoogleSSOConfig,
  getMicrosoftSSOConfig,
  updateGoogleSSOConfig,
  updateMicrosoftSSOConfig,
} from './sso'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  localStorage.clear()
})

describe('sso API', () => {
  it('gets Google SSO config for an organization', async () => {
    const config = {
      client_id: 'google-client-id',
      enabled: true,
      created_at: '2026-02-08T00:00:00Z',
      updated_at: '2026-02-08T00:00:00Z',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(config),
    })

    const result = await getGoogleSSOConfig('org-1')

    expect(result).toEqual(config)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/sso/google'),
      expect.any(Object),
    )
  })

  it('updates Google SSO config', async () => {
    const payload = {
      client_id: 'google-client-id',
      client_secret: 'google-secret',
      enabled: true,
    }

    const config = {
      client_id: 'google-client-id',
      enabled: true,
      created_at: '2026-02-08T00:00:00Z',
      updated_at: '2026-02-08T00:00:00Z',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(config),
    })

    const result = await updateGoogleSSOConfig('org-1', payload)

    expect(result).toEqual(config)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/sso/google'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
  })

  it('gets Microsoft SSO config for an organization', async () => {
    const config = {
      tenant_id: 'tenant-id',
      client_id: 'microsoft-client-id',
      enabled: false,
      created_at: '2026-02-08T00:00:00Z',
      updated_at: '2026-02-08T00:00:00Z',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(config),
    })

    const result = await getMicrosoftSSOConfig('org-1')

    expect(result).toEqual(config)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/sso/microsoft'),
      expect.any(Object),
    )
  })

  it('updates Microsoft SSO config', async () => {
    const payload = {
      tenant_id: 'tenant-id',
      client_id: 'microsoft-client-id',
      client_secret: 'microsoft-secret',
      enabled: true,
    }

    const config = {
      tenant_id: 'tenant-id',
      client_id: 'microsoft-client-id',
      enabled: true,
      created_at: '2026-02-08T00:00:00Z',
      updated_at: '2026-02-08T00:00:00Z',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(config),
    })

    const result = await updateMicrosoftSSOConfig('org-1', payload)

    expect(result).toEqual(config)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/sso/microsoft'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
  })

  it('uses backend error payload when available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'tenant_id, client_id and client_secret are required' }),
    })

    await expect(
      updateMicrosoftSSOConfig('org-1', {
        tenant_id: '',
        client_id: '',
        client_secret: '',
      }),
    ).rejects.toThrow('tenant_id, client_id and client_secret are required')
  })

  it('maps Google not configured responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    await expect(getGoogleSSOConfig('org-1')).rejects.toThrow('Google SSO not configured')
  })

  it('includes auth token when available', async () => {
    localStorage.setItem('access_token', 'token-123')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        client_id: 'google-client-id',
        enabled: true,
        created_at: '2026-02-08T00:00:00Z',
        updated_at: '2026-02-08T00:00:00Z',
      }),
    })

    await getGoogleSSOConfig('org-1')

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-123')
  })
})

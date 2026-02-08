import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listDashboardPermissions,
  listFolderPermissions,
  replaceDashboardPermissions,
  replaceFolderPermissions,
} from './permissions'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  localStorage.clear()
})

describe('permissions API', () => {
  it('lists folder permissions', async () => {
    const permissions = [
      {
        principal_type: 'user',
        principal_id: 'user-1',
        permission: 'admin',
      },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(permissions),
    })

    const result = await listFolderPermissions('folder-1')

    expect(result).toEqual(permissions)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/folders/folder-1/permissions'),
      expect.any(Object),
    )
  })

  it('replaces folder permissions', async () => {
    const payload = {
      entries: [
        {
          principal_type: 'group',
          principal_id: 'group-1',
          permission: 'view',
        },
      ],
    } as const

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(payload.entries),
    })

    const result = await replaceFolderPermissions('folder-1', { entries: [...payload.entries] })

    expect(result).toEqual(payload.entries)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/folders/folder-1/permissions'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    )
  })

  it('lists dashboard permissions', async () => {
    const permissions = [
      {
        principal_type: 'user',
        principal_id: 'user-1',
        permission: 'edit',
      },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(permissions),
    })

    const result = await listDashboardPermissions('dashboard-1')

    expect(result).toEqual(permissions)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboards/dashboard-1/permissions'),
      expect.any(Object),
    )
  })

  it('replaces dashboard permissions', async () => {
    const payload = {
      entries: [
        {
          principal_type: 'user',
          principal_id: 'user-2',
          permission: 'admin',
        },
      ],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(payload.entries),
    })

    const result = await replaceDashboardPermissions('dashboard-1', payload)

    expect(result).toEqual(payload.entries)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboards/dashboard-1/permissions'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    )
  })

  it('uses backend error payload for validation failures', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'principal does not belong to this organization' }),
    })

    await expect(replaceFolderPermissions('folder-1', { entries: [] })).rejects.toThrow(
      'principal does not belong to this organization',
    )
  })

  it('includes auth token when available', async () => {
    localStorage.setItem('access_token', 'token-123')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await listFolderPermissions('folder-1')

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-123')
  })
})

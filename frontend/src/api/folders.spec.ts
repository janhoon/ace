import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFolder, deleteFolder, getFolder, listFolders, updateFolder } from './folders'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  localStorage.clear()
})

describe('folders API', () => {
  describe('listFolders', () => {
    it('fetches folders for an org', async () => {
      const folders = [
        {
          id: 'folder-1',
          organization_id: 'org-1',
          parent_id: null,
          name: 'Infrastructure',
          sort_order: 0,
          created_by: null,
          created_at: '2026-02-08T00:00:00Z',
          updated_at: '2026-02-08T00:00:00Z',
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(folders),
      })

      const result = await listFolders('org-1')

      expect(result).toEqual(folders)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orgs/org-1/folders'),
        expect.any(Object),
      )
    })

    it('throws on 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      })

      await expect(listFolders('org-1')).rejects.toThrow('Not a member')
    })
  })

  describe('getFolder', () => {
    it('fetches a single folder', async () => {
      const folder = {
        id: 'folder-1',
        organization_id: 'org-1',
        parent_id: null,
        name: 'Infrastructure',
        sort_order: 1,
        created_by: 'user-1',
        created_at: '2026-02-08T00:00:00Z',
        updated_at: '2026-02-08T00:00:00Z',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(folder),
      })

      const result = await getFolder('folder-1')

      expect(result).toEqual(folder)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/folders/folder-1'),
        expect.any(Object),
      )
    })

    it('throws not found on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      await expect(getFolder('folder-1')).rejects.toThrow('Folder not found')
    })
  })

  describe('createFolder', () => {
    it('creates a folder', async () => {
      const folder = {
        id: 'folder-1',
        organization_id: 'org-1',
        parent_id: null,
        name: 'Infrastructure',
        sort_order: 0,
        created_by: 'user-1',
        created_at: '2026-02-08T00:00:00Z',
        updated_at: '2026-02-08T00:00:00Z',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(folder),
      })

      const result = await createFolder('org-1', {
        name: 'Infrastructure',
        sort_order: 0,
      })

      expect(result).toEqual(folder)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orgs/org-1/folders'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Infrastructure', sort_order: 0 }),
        }),
      )
    })

    it('throws backend error payload on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'name is required' }),
      })

      await expect(createFolder('org-1', { name: '' })).rejects.toThrow('name is required')
    })
  })

  describe('updateFolder', () => {
    it('updates a folder', async () => {
      const folder = {
        id: 'folder-1',
        organization_id: 'org-1',
        parent_id: null,
        name: 'Updated',
        sort_order: 2,
        created_by: 'user-1',
        created_at: '2026-02-08T00:00:00Z',
        updated_at: '2026-02-08T00:10:00Z',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(folder),
      })

      const result = await updateFolder('folder-1', { name: 'Updated', sort_order: 2 })

      expect(result).toEqual(folder)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/folders/folder-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated', sort_order: 2 }),
        }),
      )
    })
  })

  describe('deleteFolder', () => {
    it('deletes a folder', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await deleteFolder('folder-1')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/folders/folder-1'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  describe('auth headers', () => {
    it('includes auth token when available', async () => {
      localStorage.setItem('access_token', 'token-123')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })

      await listFolders('org-1')

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer token-123')
    })

    it('omits auth token when unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })

      await listFolders('org-1')

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
      expect(headers.Authorization).toBeUndefined()
    })
  })
})

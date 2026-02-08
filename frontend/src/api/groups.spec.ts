import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  listGroupMembers,
  listGroups,
  removeGroupMember,
  updateGroup,
} from './groups'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  localStorage.clear()
})

describe('groups API', () => {
  it('lists groups for an organization', async () => {
    const groups = [
      {
        id: 'group-1',
        organization_id: 'org-1',
        name: 'SRE Team',
        description: 'Operations engineers',
        created_by: 'user-1',
        created_at: '2026-02-08T00:00:00Z',
        updated_at: '2026-02-08T00:00:00Z',
      },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(groups),
    })

    const result = await listGroups('org-1')

    expect(result).toEqual(groups)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/groups'),
      expect.any(Object),
    )
  })

  it('creates a group', async () => {
    const group = {
      id: 'group-1',
      organization_id: 'org-1',
      name: 'SRE Team',
      description: 'Operations engineers',
      created_by: 'user-1',
      created_at: '2026-02-08T00:00:00Z',
      updated_at: '2026-02-08T00:00:00Z',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(group),
    })

    const result = await createGroup('org-1', {
      name: 'SRE Team',
      description: 'Operations engineers',
    })

    expect(result).toEqual(group)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/groups'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'SRE Team',
          description: 'Operations engineers',
        }),
      }),
    )
  })

  it('updates a group', async () => {
    const updated = {
      id: 'group-1',
      organization_id: 'org-1',
      name: 'SRE',
      description: 'Updated description',
      created_by: 'user-1',
      created_at: '2026-02-08T00:00:00Z',
      updated_at: '2026-02-08T00:05:00Z',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(updated),
    })

    const result = await updateGroup('org-1', 'group-1', {
      name: 'SRE',
      description: 'Updated description',
    })

    expect(result).toEqual(updated)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/groups/group-1'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'SRE',
          description: 'Updated description',
        }),
      }),
    )
  })

  it('deletes a group', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    await deleteGroup('org-1', 'group-1')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/groups/group-1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('lists group members', async () => {
    const members = [
      {
        id: 'membership-1',
        organization_id: 'org-1',
        group_id: 'group-1',
        user_id: 'user-2',
        email: 'user@example.com',
        name: 'User Name',
        created_at: '2026-02-08T00:00:00Z',
        updated_at: '2026-02-08T00:00:00Z',
      },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(members),
    })

    const result = await listGroupMembers('org-1', 'group-1')

    expect(result).toEqual(members)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/groups/group-1/members'),
      expect.any(Object),
    )
  })

  it('adds a group member', async () => {
    const member = {
      id: 'membership-1',
      organization_id: 'org-1',
      group_id: 'group-1',
      user_id: 'user-2',
      email: 'user@example.com',
      name: 'User Name',
      created_at: '2026-02-08T00:00:00Z',
      updated_at: '2026-02-08T00:00:00Z',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(member),
    })

    const result = await addGroupMember('org-1', 'group-1', { user_id: 'user-2' })

    expect(result).toEqual(member)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/groups/group-1/members'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user_id: 'user-2' }),
      }),
    )
  })

  it('removes a group member', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    await removeGroupMember('org-1', 'group-1', 'user-2')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-1/groups/group-1/members/user-2'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('uses backend error payload when available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'group name already exists in this organization' }),
    })

    await expect(createGroup('org-1', { name: 'SRE Team' })).rejects.toThrow(
      'group name already exists in this organization',
    )
  })

  it('includes auth token when available', async () => {
    localStorage.setItem('access_token', 'token-123')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await listGroups('org-1')

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-123')
  })
})

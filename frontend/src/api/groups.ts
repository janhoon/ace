import type {
  AddUserGroupMemberRequest,
  CreateUserGroupRequest,
  UpdateUserGroupRequest,
  UserGroup,
  UserGroupMembership,
} from '../types/rbac'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  const error = await response.json().catch(() => ({})) as { error?: string }
  return error.error || fallback
}

export async function listGroups(orgId: string): Promise<UserGroup[]> {
  const response = await fetch(`${API_BASE}/api/orgs/${orgId}/groups`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Not a member of this organization')
    }
    throw new Error(await getErrorMessage(response, 'Failed to fetch groups'))
  }

  return response.json()
}

export async function createGroup(orgId: string, data: CreateUserGroupRequest): Promise<UserGroup> {
  const response = await fetch(`${API_BASE}/api/orgs/${orgId}/groups`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Admin access required')
    }
    throw new Error(await getErrorMessage(response, 'Failed to create group'))
  }

  return response.json()
}

export async function updateGroup(
  orgId: string,
  groupId: string,
  data: UpdateUserGroupRequest,
): Promise<UserGroup> {
  const response = await fetch(`${API_BASE}/api/orgs/${orgId}/groups/${groupId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Admin access required')
    }
    if (response.status === 404) {
      throw new Error('Group not found')
    }
    throw new Error(await getErrorMessage(response, 'Failed to update group'))
  }

  return response.json()
}

export async function deleteGroup(orgId: string, groupId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/orgs/${orgId}/groups/${groupId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Admin access required')
    }
    if (response.status === 404) {
      throw new Error('Group not found')
    }
    throw new Error(await getErrorMessage(response, 'Failed to delete group'))
  }
}

export async function listGroupMembers(orgId: string, groupId: string): Promise<UserGroupMembership[]> {
  const response = await fetch(`${API_BASE}/api/orgs/${orgId}/groups/${groupId}/members`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Not a member of this organization')
    }
    if (response.status === 404) {
      throw new Error('Group not found')
    }
    throw new Error(await getErrorMessage(response, 'Failed to fetch group members'))
  }

  return response.json()
}

export async function addGroupMember(
  orgId: string,
  groupId: string,
  data: AddUserGroupMemberRequest,
): Promise<UserGroupMembership> {
  const response = await fetch(`${API_BASE}/api/orgs/${orgId}/groups/${groupId}/members`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Admin access required')
    }
    if (response.status === 404) {
      throw new Error('Group not found')
    }
    throw new Error(await getErrorMessage(response, 'Failed to add group member'))
  }

  return response.json()
}

export async function removeGroupMember(orgId: string, groupId: string, userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/orgs/${orgId}/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Admin access required')
    }
    if (response.status === 404) {
      throw new Error('Group member not found')
    }
    throw new Error(await getErrorMessage(response, 'Failed to remove group member'))
  }
}

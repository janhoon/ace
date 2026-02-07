import type {
  DataSource,
  CreateDataSourceRequest,
  UpdateDataSourceRequest,
  DataSourceQueryRequest,
  DataSourceQueryResult,
} from '../types/datasource'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function listDataSources(orgId: string): Promise<DataSource[]> {
  const response = await fetch(`${API_BASE}/api/orgs/${orgId}/datasources`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Not a member of this organization')
    }
    throw new Error('Failed to fetch datasources')
  }
  return response.json()
}

export async function getDataSource(id: string): Promise<DataSource> {
  const response = await fetch(`${API_BASE}/api/datasources/${id}`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('Datasource not found')
  }
  return response.json()
}

export async function createDataSource(
  orgId: string,
  data: CreateDataSourceRequest,
): Promise<DataSource> {
  const response = await fetch(`${API_BASE}/api/orgs/${orgId}/datasources`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Only admins can create datasources')
    }
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create datasource')
  }
  return response.json()
}

export async function updateDataSource(
  id: string,
  data: UpdateDataSourceRequest,
): Promise<DataSource> {
  const response = await fetch(`${API_BASE}/api/datasources/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Only admins can update datasources')
    }
    throw new Error('Failed to update datasource')
  }
  return response.json()
}

export async function deleteDataSource(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/datasources/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Only admins can delete datasources')
    }
    throw new Error('Failed to delete datasource')
  }
}

export async function queryDataSource(
  id: string,
  data: DataSourceQueryRequest,
): Promise<DataSourceQueryResult> {
  const response = await fetch(`${API_BASE}/api/datasources/${id}/query`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Query failed')
  }
  return response.json()
}

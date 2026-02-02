import type { Panel, CreatePanelRequest, UpdatePanelRequest } from '../types/panel'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export async function listPanels(dashboardId: string): Promise<Panel[]> {
  const response = await fetch(`${API_BASE}/api/dashboards/${dashboardId}/panels`)
  if (!response.ok) {
    throw new Error('Failed to fetch panels')
  }
  return response.json()
}

export async function createPanel(dashboardId: string, data: CreatePanelRequest): Promise<Panel> {
  const response = await fetch(`${API_BASE}/api/dashboards/${dashboardId}/panels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to create panel')
  }
  return response.json()
}

export async function updatePanel(id: string, data: UpdatePanelRequest): Promise<Panel> {
  const response = await fetch(`${API_BASE}/api/panels/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to update panel')
  }
  return response.json()
}

export async function deletePanel(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/panels/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete panel')
  }
}

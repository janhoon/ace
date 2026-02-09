import type { GrafanaConvertResponse } from '../types/converter'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function convertGrafanaDashboard(
  source: string,
  format: 'json' | 'yaml',
): Promise<GrafanaConvertResponse> {
  const response = await fetch(`${API_BASE}/api/convert/grafana?format=${format}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: source,
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }

    let message = 'Failed to convert Grafana dashboard'
    try {
      const errorData = await response.json() as { error?: string }
      if (errorData.error) {
        message = errorData.error
      }
    } catch {
      // keep fallback message
    }

    throw new Error(message)
  }

  return response.json()
}

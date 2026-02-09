export interface DashboardVariable {
  name: string
  type: string
  label?: string
  query?: string
  multi?: boolean
  include_all?: boolean
}

export interface DashboardTimeRange {
  from: string
  to: string
}

export interface DashboardPanelResource {
  title: string
  type: string
  grid_pos: Record<string, number>
  query?: Record<string, string>
}

export interface DashboardDocument {
  schema_version: number
  dashboard: {
    id?: string
    title: string
    description?: string
    panels: DashboardPanelResource[]
    variables?: DashboardVariable[]
    time_range?: DashboardTimeRange
    refresh_interval?: string
  }
}

export interface GrafanaConvertResponse {
  format: 'json' | 'yaml'
  content: string
  document: DashboardDocument
  warnings: string[]
}

export type DataSourceType = 'prometheus' | 'loki' | 'victorialogs' | 'victoriametrics'

export interface DataSource {
  id: string
  organization_id: string
  name: string
  type: DataSourceType
  url: string
  is_default: boolean
  auth_type: string
  auth_config?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateDataSourceRequest {
  name: string
  type: DataSourceType
  url: string
  is_default?: boolean
  auth_type?: string
  auth_config?: Record<string, unknown>
}

export interface UpdateDataSourceRequest {
  name?: string
  type?: DataSourceType
  url?: string
  is_default?: boolean
  auth_type?: string
  auth_config?: Record<string, unknown>
}

export interface DataSourceQueryRequest {
  query: string
  start: number
  end: number
  step?: number
  limit?: number
}

export interface DataSourceLogStreamRequest {
  query: string
  start?: number
  limit?: number
}

export interface MetricResult {
  metric: Record<string, string>
  values: [number, string][]
}

export interface LogEntry {
  timestamp: string
  line: string
  labels?: Record<string, string>
  level?: string
}

export interface DataSourceQueryResult {
  status: 'success' | 'error'
  data?: {
    resultType: string
    result?: MetricResult[]
    logs?: LogEntry[]
  }
  error?: string
  resultType: 'metrics' | 'logs'
}

export function isMetricsType(type_: DataSourceType): boolean {
  return type_ === 'prometheus' || type_ === 'victoriametrics'
}

export function isLogsType(type_: DataSourceType): boolean {
  return type_ === 'loki' || type_ === 'victorialogs'
}

export const dataSourceTypeLabels: Record<DataSourceType, string> = {
  prometheus: 'Prometheus',
  loki: 'Loki',
  victorialogs: 'Victoria Logs',
  victoriametrics: 'VictoriaMetrics',
}

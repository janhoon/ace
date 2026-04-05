import vmClusterHealth from './vm-cluster-health.json'
import nodeExporter from './node-exporter.json'
import goRuntime from './go-runtime.json'

export interface DashboardTemplate {
  id: string
  name: string
  description: string
  category: string
  panelCount: number
  spec: typeof vmClusterHealth
}

export const templates: DashboardTemplate[] = [
  {
    id: 'vm-cluster-health',
    name: 'VictoriaMetrics Cluster Health',
    description: 'Ingestion rate, query latency, storage usage, and memory for VictoriaMetrics.',
    category: 'VictoriaMetrics',
    panelCount: vmClusterHealth.dashboard.panels.length,
    spec: vmClusterHealth,
  },
  {
    id: 'node-exporter',
    name: 'Node Exporter',
    description: 'CPU, memory, disk, and network metrics from node_exporter.',
    category: 'Infrastructure',
    panelCount: nodeExporter.dashboard.panels.length,
    spec: nodeExporter,
  },
  {
    id: 'go-runtime',
    name: 'Go Runtime',
    description: 'Goroutines, heap usage, GC pause times, and HTTP performance.',
    category: 'Application',
    panelCount: goRuntime.dashboard.panels.length,
    spec: goRuntime,
  },
]

export function getTemplateById(id: string): DashboardTemplate | undefined {
  return templates.find(t => t.id === id)
}

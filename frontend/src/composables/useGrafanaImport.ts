import { ref, computed } from 'vue'
import { convertGrafanaDashboard } from '../api/converter'
import { connectToGrafana, listGrafanaDashboards, getGrafanaDashboard } from '../api/grafanaDiscovery'
import { importDashboardYaml } from '../api/dashboards'
import { bulkCreateVariables } from '../api/variables'
import type { GrafanaConvertResponse } from '../types/converter'
import type { GrafanaDashboardSummary } from '../api/grafanaDiscovery'

export type ImportStep = 'source' | 'preview' | 'mapping' | 'importing' | 'done'

export interface DatasourceMapping {
  grafanaName: string
  aceDatasourceId: string | null
}

export function useGrafanaImport() {
  const step = ref<ImportStep>('source')
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Grafana connection state
  const grafanaUrl = ref('')
  const grafanaApiKey = ref('')
  const connected = ref(false)
  const grafanaVersion = ref('')
  const remoteDashboards = ref<GrafanaDashboardSummary[]>([])

  // Conversion state
  const convertResponse = ref<GrafanaConvertResponse | null>(null)
  const report = computed(() => convertResponse.value?.report ?? null)
  const document = computed(() => convertResponse.value?.document ?? null)
  const warnings = computed(() => convertResponse.value?.warnings ?? [])
  const variables = computed(() => document.value?.dashboard?.variables ?? [])

  // Datasource mapping
  const datasourceMappings = ref<DatasourceMapping[]>([])

  // Import result
  const importedDashboardId = ref<string | null>(null)

  async function connectGrafana() {
    if (!grafanaUrl.value) {
      error.value = 'Grafana URL is required'
      return
    }
    loading.value = true
    error.value = null
    try {
      const resp = await connectToGrafana(grafanaUrl.value, grafanaApiKey.value)
      if (!resp.ok) {
        error.value = resp.error || 'Failed to connect to Grafana'
        return
      }
      connected.value = true
      grafanaVersion.value = resp.version || ''

      // Auto-fetch dashboards list
      remoteDashboards.value = await listGrafanaDashboards(grafanaUrl.value, grafanaApiKey.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Connection failed'
    } finally {
      loading.value = false
    }
  }

  async function convertFromJson(jsonContent: string) {
    loading.value = true
    error.value = null
    try {
      const resp = await convertGrafanaDashboard(jsonContent, 'yaml')
      convertResponse.value = resp

      // Extract unique datasource names from panels for mapping
      extractDatasourceMappings(jsonContent)
      step.value = 'preview'
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Conversion failed'
    } finally {
      loading.value = false
    }
  }

  async function convertFromRemote(uid: string) {
    loading.value = true
    error.value = null
    try {
      const dashJson = await getGrafanaDashboard(uid, grafanaUrl.value, grafanaApiKey.value)
      await convertFromJson(dashJson)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch dashboard from Grafana'
    } finally {
      loading.value = false
    }
  }

  function extractDatasourceMappings(jsonContent: string) {
    try {
      const parsed = JSON.parse(jsonContent)
      const panels = parsed.dashboard?.panels ?? parsed.panels ?? []
      const dsNames = new Set<string>()
      for (const panel of panels) {
        if (panel.datasource) {
          const name = typeof panel.datasource === 'string'
            ? panel.datasource
            : panel.datasource.uid || panel.datasource.type || ''
          if (name && name !== '-- Mixed --') dsNames.add(name)
        }
        for (const target of panel.targets ?? []) {
          if (target.datasource) {
            const name = typeof target.datasource === 'string'
              ? target.datasource
              : target.datasource.uid || target.datasource.type || ''
            if (name && name !== '-- Mixed --') dsNames.add(name)
          }
        }
      }
      datasourceMappings.value = Array.from(dsNames).map(name => ({
        grafanaName: name,
        aceDatasourceId: null,
      }))
    } catch {
      datasourceMappings.value = []
    }
  }

  async function importDashboard(orgId: string) {
    if (!convertResponse.value) {
      error.value = 'No converted dashboard to import'
      return
    }

    step.value = 'importing'
    loading.value = true
    error.value = null

    try {
      const result = await importDashboardYaml(orgId, convertResponse.value.content)
      importedDashboardId.value = result.id

      // Create variables if any were extracted
      const vars = document.value?.dashboard?.variables
      if (vars && vars.length > 0 && result.id) {
        await bulkCreateVariables(result.id, vars.map((v, i) => ({
          name: v.name,
          type: v.type || 'query',
          label: v.label,
          query: v.query,
          multi: v.multi ?? false,
          include_all: v.include_all ?? false,
          sort_order: i,
        })))
      }

      step.value = 'done'
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Import failed'
      step.value = 'preview'
    } finally {
      loading.value = false
    }
  }

  function reset() {
    step.value = 'source'
    loading.value = false
    error.value = null
    convertResponse.value = null
    datasourceMappings.value = []
    importedDashboardId.value = null
    connected.value = false
    remoteDashboards.value = []
  }

  return {
    // State
    step,
    loading,
    error,
    grafanaUrl,
    grafanaApiKey,
    connected,
    grafanaVersion,
    remoteDashboards,
    convertResponse,
    report,
    document,
    warnings,
    variables,
    datasourceMappings,
    importedDashboardId,
    // Actions
    connectGrafana,
    convertFromJson,
    convertFromRemote,
    importDashboard,
    reset,
  }
}

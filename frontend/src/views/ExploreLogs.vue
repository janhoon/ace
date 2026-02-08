<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Play, AlertCircle, History, X, Loader2, HeartPulse, CircleAlert, ChevronDown, ChevronUp, Check } from 'lucide-vue-next'
import TimeRangePicker from '../components/TimeRangePicker.vue'
import LogViewer from '../components/LogViewer.vue'
import MonacoQueryEditor from '../components/MonacoQueryEditor.vue'
import { useTimeRange } from '../composables/useTimeRange'
import { useOrganization } from '../composables/useOrganization'
import { useDatasource } from '../composables/useDatasource'
import { queryDataSource, fetchDataSourceLabels } from '../api/datasources'
import type { DataSourceType } from '../types/datasource'
import { dataSourceTypeLabels } from '../types/datasource'
import type { LogEntry } from '../types/datasource'
import prometheusLogo from '../assets/datasources/prometheus-logo.svg'
import lokiLogo from '../assets/datasources/loki-logo.svg'
import victoriaMetricsLogo from '../assets/datasources/victoriametrics-logo.svg'
import victoriaLogsLogo from '../assets/datasources/victorialogs-logo.svg'

const { timeRange, onRefresh } = useTimeRange()
const { currentOrg } = useOrganization()
const { logsDatasources, fetchDatasources } = useDatasource()

const dataSourceTypeLogos: Record<DataSourceType, string> = {
  prometheus: prometheusLogo,
  loki: lokiLogo,
  victoriametrics: victoriaMetricsLogo,
  victorialogs: victoriaLogsLogo,
}

type DatasourceHealthStatus = 'unknown' | 'checking' | 'healthy' | 'unhealthy'

const selectedDatasourceId = ref('')
const query = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const logs = ref<LogEntry[]>([])
const hasSuccessfulQuery = ref(false)

const HISTORY_KEY = 'explore_logs_query_history'
const MAX_HISTORY = 10
const queryHistory = ref<string[]>([])
const showHistory = ref(false)
const showDatasourceMenu = ref(false)
const datasourceMenuRef = ref<HTMLElement | null>(null)
const datasourceHealth = ref<Record<string, DatasourceHealthStatus>>({})
const datasourceHealthErrors = ref<Record<string, string>>({})
const indexedLabels = ref<string[]>([])
const labelsCache = ref<Map<string, string[]>>(new Map())

onMounted(() => {
  const stored = sessionStorage.getItem(HISTORY_KEY)
  if (stored) {
    try {
      queryHistory.value = JSON.parse(stored)
    } catch {
      queryHistory.value = []
    }
  }

  if (currentOrg.value) {
    fetchDatasources(currentOrg.value.id)
  }
})

watch(
  () => currentOrg.value?.id,
  (orgId, previousOrgId) => {
    if (orgId && orgId !== previousOrgId) {
      fetchDatasources(orgId)
    }
  },
)

watch(
  logsDatasources,
  (sources) => {
    if (sources.length === 0) {
      selectedDatasourceId.value = ''
      return
    }

    const hasSelected = sources.some(ds => ds.id === selectedDatasourceId.value)
    if (!hasSelected) {
      const defaultDatasource = sources.find(ds => ds.is_default)
      selectedDatasourceId.value = defaultDatasource?.id || sources[0].id
    }
  },
  { immediate: true },
)

watch(
  logsDatasources,
  (sources) => {
    const sourceIds = new Set(sources.map(ds => ds.id))
    datasourceHealth.value = Object.fromEntries(
      Object.entries(datasourceHealth.value).filter(([id]) => sourceIds.has(id)),
    )
    datasourceHealthErrors.value = Object.fromEntries(
      Object.entries(datasourceHealthErrors.value).filter(([id]) => sourceIds.has(id)),
    )

    const filteredCache = new Map<string, string[]>()
    for (const [id, labels] of labelsCache.value.entries()) {
      if (sourceIds.has(id)) {
        filteredCache.set(id, labels)
      }
    }
    labelsCache.value = filteredCache
  },
)

function addToHistory(q: string) {
  if (!q.trim()) return

  const filtered = queryHistory.value.filter(h => h !== q)
  queryHistory.value = [q, ...filtered].slice(0, MAX_HISTORY)
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(queryHistory.value))
}

async function runQuery() {
  if (!selectedDatasourceId.value) {
    error.value = 'Select a logs datasource'
    return
  }

  if (!query.value.trim()) {
    error.value = 'Query is required'
    return
  }

  loading.value = true
  error.value = null
  logs.value = []
  hasSuccessfulQuery.value = false

  try {
    const start = Math.floor(timeRange.value.start / 1000)
    const end = Math.floor(timeRange.value.end / 1000)

    const response = await queryDataSource(selectedDatasourceId.value, {
      query: query.value,
      start,
      end,
      step: 15,
      limit: 1000,
    })

    if (response.status === 'error') {
      error.value = response.error || 'Query failed'
      return
    }

    if (response.resultType !== 'logs') {
      error.value = 'Selected datasource did not return log results'
      return
    }

    logs.value = response.data?.logs || []
    hasSuccessfulQuery.value = true
    addToHistory(query.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to execute query'
  } finally {
    loading.value = false
  }
}

function selectHistoryQuery(q: string) {
  query.value = q
  showHistory.value = false
}

function clearHistory() {
  queryHistory.value = []
  sessionStorage.removeItem(HISTORY_KEY)
}

async function loadIndexedLabels(datasourceId: string) {
  if (labelsCache.value.has(datasourceId)) {
    indexedLabels.value = labelsCache.value.get(datasourceId) || []
    return
  }

  try {
    const labels = await fetchDataSourceLabels(datasourceId)
    labelsCache.value.set(datasourceId, labels)
    if (selectedDatasourceId.value === datasourceId) {
      indexedLabels.value = labels
    }
  } catch {
    if (selectedDatasourceId.value === datasourceId) {
      indexedLabels.value = []
    }
  }
}

let unsubscribeRefresh: (() => void) | null = null

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  unsubscribeRefresh = onRefresh(() => {
    if (query.value.trim() && selectedDatasourceId.value && hasSuccessfulQuery.value) {
      runQuery()
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  if (unsubscribeRefresh) {
    unsubscribeRefresh()
  }
})

const hasLogsDatasources = computed(() => logsDatasources.value.length > 0)
const hasResults = computed(() => hasSuccessfulQuery.value && logs.value.length > 0)
const activeDatasource = computed(
  () => logsDatasources.value.find(ds => ds.id === selectedDatasourceId.value) || null,
)
const queryLanguage = computed<'logql' | 'logsql'>(() => {
  if (activeDatasource.value?.type === 'victorialogs') {
    return 'logsql'
  }
  return 'logql'
})
const queryLabel = computed(() => (queryLanguage.value === 'logsql' ? 'LogsQL Query' : 'LogQL Query'))
const queryPlaceholder = computed(() => {
  if (queryLanguage.value === 'logsql') {
    return '*'
  }
  return '{job=~".+"} |= "error"'
})
const activeDatasourceHealth = computed<DatasourceHealthStatus>(() => {
  if (!activeDatasource.value) {
    return 'unknown'
  }

  return datasourceHealth.value[activeDatasource.value.id] || 'unknown'
})
const activeDatasourceHealthLabel = computed(() => {
  if (activeDatasourceHealth.value === 'healthy') return 'Healthy'
  if (activeDatasourceHealth.value === 'unhealthy') return 'Unhealthy'
  if (activeDatasourceHealth.value === 'checking') return 'Checking...'
  return 'Unknown'
})
const activeDatasourceHealthError = computed(() => {
  if (!activeDatasource.value) {
    return ''
  }

  return datasourceHealthErrors.value[activeDatasource.value.id] || ''
})

function getTypeLogo(type_: DataSourceType): string {
  return dataSourceTypeLogos[type_]
}

function toggleDatasourceMenu() {
  if (loading.value || !hasLogsDatasources.value) {
    return
  }

  showDatasourceMenu.value = !showDatasourceMenu.value
}

function selectDatasource(datasourceId: string) {
  selectedDatasourceId.value = datasourceId
  showDatasourceMenu.value = false
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node
  if (!datasourceMenuRef.value?.contains(target)) {
    showDatasourceMenu.value = false
  }
}

function getSmokeQuery(type_: DataSourceType): string {
  if (type_ === 'prometheus' || type_ === 'victoriametrics') {
    return 'up'
  }
  if (type_ === 'loki') {
    return '{job=~".+"}'
  }
  return '*'
}

async function checkDatasourceHealth(datasourceId: string, type_: DataSourceType) {
  datasourceHealth.value[datasourceId] = 'checking'
  delete datasourceHealthErrors.value[datasourceId]

  const end = Math.floor(Date.now() / 1000)
  const start = end - 15 * 60

  try {
    const healthResult = await queryDataSource(datasourceId, {
      query: getSmokeQuery(type_),
      start,
      end,
      step: 15,
      limit: 100,
    })

    if (healthResult.status === 'error') {
      throw new Error(healthResult.error || 'Health check failed')
    }

    datasourceHealth.value[datasourceId] = 'healthy'
  } catch (e) {
    datasourceHealth.value[datasourceId] = 'unhealthy'
    datasourceHealthErrors.value[datasourceId] =
      e instanceof Error ? e.message : 'Health check failed'
  }
}

watch(
  activeDatasource,
  (datasource) => {
    if (!datasource) {
      return
    }

    if ((datasourceHealth.value[datasource.id] || 'unknown') === 'unknown') {
      checkDatasourceHealth(datasource.id, datasource.type)
    }
  },
  { immediate: true },
)

watch(selectedDatasourceId, () => {
  showDatasourceMenu.value = false
})

watch(() => selectedDatasourceId.value, (datasourceId) => {
  if (!datasourceId) {
    indexedLabels.value = []
    return
  }

  void loadIndexedLabels(datasourceId)
}, { immediate: true })
</script>

<template>
  <div class="explore-page">
    <header class="explore-header">
      <div class="header-title">
        <h1>Explore</h1>
        <span class="mode-badge">Logs</span>
      </div>
    </header>

    <div class="explore-content">
      <div class="query-section">
        <div class="query-context-row">
          <div class="datasource-row">
            <label>Data Source</label>
            <div ref="datasourceMenuRef" class="datasource-selector">
              <button
                type="button"
                class="active-datasource-panel datasource-trigger"
                :disabled="loading || !hasLogsDatasources"
                @click="toggleDatasourceMenu"
                :title="activeDatasource ? `Active datasource: ${activeDatasource.name}` : 'No logs datasource configured'"
              >
                <template v-if="activeDatasource">
                  <img
                    :src="getTypeLogo(activeDatasource.type)"
                    :alt="`${dataSourceTypeLabels[activeDatasource.type]} logo`"
                    class="active-datasource-logo"
                  />
                  <div class="active-datasource-meta">
                    <span class="active-datasource-label">Active Source</span>
                    <strong class="active-datasource-name">{{ activeDatasource.name }}</strong>
                    <span class="active-datasource-type">{{ dataSourceTypeLabels[activeDatasource.type] }}</span>
                  </div>
                  <span
                    class="source-health-badge"
                    :class="`health-${activeDatasourceHealth}`"
                    :title="activeDatasourceHealthError || activeDatasourceHealthLabel"
                  >
                    <Loader2 v-if="activeDatasourceHealth === 'checking'" :size="12" class="icon-spin" />
                    <HeartPulse v-else-if="activeDatasourceHealth === 'healthy'" :size="12" />
                    <CircleAlert v-else-if="activeDatasourceHealth === 'unhealthy'" :size="12" />
                    <span>{{ activeDatasourceHealthLabel }}</span>
                  </span>
                </template>

                <span v-else class="active-datasource-empty">No logs datasource configured</span>

                <component
                  :is="showDatasourceMenu ? ChevronUp : ChevronDown"
                  :size="16"
                  class="datasource-chevron"
                />
              </button>

              <div v-if="showDatasourceMenu && hasLogsDatasources" class="datasource-dropdown">
                <button
                  v-for="ds in logsDatasources"
                  :key="ds.id"
                  type="button"
                  class="datasource-option"
                  :class="{ selected: ds.id === selectedDatasourceId }"
                  @click="selectDatasource(ds.id)"
                >
                  <img
                    :src="getTypeLogo(ds.type)"
                    :alt="`${dataSourceTypeLabels[ds.type]} logo`"
                    class="datasource-option-logo"
                  />
                  <div class="datasource-option-meta">
                    <strong>{{ ds.name }}</strong>
                    <span>{{ dataSourceTypeLabels[ds.type] }}</span>
                  </div>
                  <Check v-if="ds.id === selectedDatasourceId" :size="14" class="datasource-option-check" />
                </button>
              </div>
            </div>
          </div>

          <div class="query-time-controls">
            <label>Query Range</label>
            <TimeRangePicker stacked />
          </div>
        </div>

        <div class="query-builder-wrapper">
          <label class="query-label">{{ queryLabel }}</label>
          <MonacoQueryEditor
            v-model="query"
            class="query-input"
            :language="queryLanguage"
            :indexed-labels="indexedLabels"
            :disabled="loading || !hasLogsDatasources"
            :height="130"
            :placeholder="queryPlaceholder"
            @submit="runQuery"
          />

          <div v-if="queryHistory.length > 0" class="history-container">
            <button
              class="history-btn"
              :class="{ active: showHistory }"
              @click="showHistory = !showHistory"
              title="Query history"
            >
              <History :size="16" />
              <span>History</span>
            </button>

            <div v-if="showHistory" class="history-dropdown">
              <div class="history-header">
                <span>Recent Queries</span>
                <button class="clear-history-btn" @click="clearHistory" title="Clear history">
                  <X :size="14" />
                </button>
              </div>
              <button
                v-for="(q, index) in queryHistory"
                :key="index"
                class="history-item"
                @click="selectHistoryQuery(q)"
              >
                <code>{{ q }}</code>
              </button>
            </div>
          </div>
        </div>

        <div class="query-actions">
          <button
            class="btn btn-run"
            :disabled="loading || !query.trim() || !selectedDatasourceId || !hasLogsDatasources"
            @click="runQuery"
          >
            <Play :size="16" />
            <span>{{ loading ? 'Running...' : 'Run Query' }}</span>
          </button>
          <span class="hint">Ctrl+Enter to run</span>
        </div>

        <div v-if="error" class="query-error">
          <AlertCircle :size="16" />
          <span>{{ error }}</span>
        </div>
      </div>

      <div class="results-section">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <span>Executing query...</span>
        </div>

        <div v-else-if="hasResults" class="results-container">
          <div class="results-header">
            <span class="result-count">{{ logs.length }} {{ logs.length === 1 ? 'entry' : 'entries' }}</span>
          </div>
          <div class="log-viewer-container">
            <LogViewer :logs="logs" />
          </div>
        </div>

        <div v-else-if="hasSuccessfulQuery && logs.length === 0" class="empty-state">
          <p>No logs returned for the selected time range.</p>
        </div>

        <div v-else-if="!hasLogsDatasources" class="empty-state">
          <p>No logs datasource configured.</p>
          <p class="hint-text">Add a Loki or Victoria Logs datasource in Data Sources.</p>
        </div>

        <div v-else class="empty-state">
          <p>Write a log query and click "Run Query" to inspect logs.</p>
          <p class="hint-text">Examples: <code>{job=~".+"}</code>, <code>{app="api"} |= "error"</code>, <code>*</code></p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.explore-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 1.25rem 1.8rem;
}

.explore-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.95rem 1.15rem;
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  background: var(--surface-1);
  box-shadow: var(--shadow-sm);
}

.header-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.explore-header h1 {
  font-size: 1.08rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-family: var(--font-mono);
  color: var(--text-primary);
  margin: 0;
}

.mode-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.38);
  background: rgba(56, 189, 248, 0.14);
  color: #bde9ff;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.active-datasource-panel {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border-primary);
  background: var(--bg-tertiary);
}

.datasource-trigger {
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.datasource-trigger:hover:not(:disabled) {
  border-color: var(--border-secondary);
  background: var(--bg-hover);
}

.datasource-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.active-datasource-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
}

.active-datasource-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.1rem;
}

.active-datasource-label {
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.active-datasource-name {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.active-datasource-type {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.active-datasource-empty {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.source-health-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  border: 1px solid var(--border-primary);
  color: var(--text-secondary);
}

.source-health-badge.health-checking {
  border-color: rgba(148, 163, 184, 0.45);
  color: var(--text-secondary);
}

.source-health-badge.health-healthy {
  border-color: rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.12);
  color: #7de9c5;
}

.source-health-badge.health-unhealthy {
  border-color: rgba(244, 63, 94, 0.4);
  background: rgba(244, 63, 94, 0.12);
  color: #ff9db0;
}

.source-health-badge.health-unknown {
  border-color: rgba(148, 163, 184, 0.45);
  background: rgba(148, 163, 184, 0.1);
}

.icon-spin {
  animation: spin 0.9s linear infinite;
}

.datasource-selector {
  position: relative;
}

.datasource-chevron {
  margin-left: 0.25rem;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.datasource-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: rgba(11, 21, 33, 0.98);
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  z-index: 110;
  max-height: 280px;
  overflow-y: auto;
}

.datasource-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  background: transparent;
  border: none;
  text-align: left;
  color: var(--text-primary);
  cursor: pointer;
}

.datasource-option:hover {
  background: var(--bg-hover);
}

.datasource-option.selected {
  background: rgba(56, 189, 248, 0.14);
}

.datasource-option-logo {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex-shrink: 0;
}

.datasource-option-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.datasource-option-meta strong {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-primary);
}

.datasource-option-meta span {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.datasource-option-check {
  margin-left: auto;
  color: var(--accent-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.explore-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
}

.query-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem;
  background: var(--surface-1);
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
}

.query-context-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: end;
}

.datasource-row {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.datasource-row label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.query-time-controls {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.query-time-controls label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.query-builder-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.query-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.query-input {
  width: 100%;
}

.history-container {
  position: relative;
}

.history-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
}

.history-btn:hover,
.history-btn.active {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-secondary);
}

.history-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 350px;
  max-height: 300px;
  overflow-y: auto;
  background: rgba(11, 21, 33, 0.98);
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-primary);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.clear-history-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}

.clear-history-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-danger);
}

.history-item {
  display: block;
  width: 100%;
  padding: 0.625rem 1rem;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.history-item:hover {
  background: var(--bg-hover);
}

.history-item code {
  display: block;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8125rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.query-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-run {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--accent-success);
  border: 1px solid var(--accent-success);
  border-radius: 10px;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-run:hover:not(:disabled) {
  background: #0ea67d;
  border-color: #0ea67d;
}

.btn-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.query-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(251, 113, 133, 0.1);
  border: 1px solid rgba(251, 113, 133, 0.3);
  border-radius: 8px;
  color: var(--accent-danger);
  font-size: 0.875rem;
}

.results-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  overflow: hidden;
  min-height: 400px;
  box-shadow: var(--shadow-sm);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  color: var(--text-secondary);
  flex: 1;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(50, 81, 115, 0.65);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.results-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-primary);
  background: rgba(20, 32, 50, 0.9);
}

.result-count {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.log-viewer-container {
  flex: 1;
  min-height: 0;
  padding: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem;
  text-align: center;
  flex: 1;
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.empty-state .hint-text {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.empty-state code {
  padding: 0.125rem 0.375rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8125rem;
  color: var(--text-accent);
}

@media (max-width: 900px) {
  .explore-page {
    padding: 0.9rem;
  }

  .explore-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.65rem;
  }

  .header-title {
    justify-content: flex-start;
  }

  .active-datasource-panel {
    width: 100%;
  }

  .query-context-row {
    grid-template-columns: 1fr;
  }

  .history-dropdown {
    width: 100%;
  }
}
</style>

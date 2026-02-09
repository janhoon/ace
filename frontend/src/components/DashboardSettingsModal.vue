<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, Settings, X } from 'lucide-vue-next'
import { exportDashboardYaml, updateDashboard } from '../api/dashboards'
import { convertGrafanaDashboard } from '../api/converter'
import type { Dashboard } from '../types/dashboard'

interface DashboardViewSettings {
  timeRangePreset: string
  refreshInterval: string
  variables: string[]
}

const props = defineProps<{
  dashboard: Dashboard
  canEdit: boolean
  defaultSettings: DashboardViewSettings
}>()

const emit = defineEmits<{
  close: []
  saved: [
    {
      title: string
      description: string
      settings: DashboardViewSettings
    },
  ]
}>()

const TIME_RANGE_OPTIONS = [
  { label: 'Last 5 minutes', value: '5m' },
  { label: 'Last 15 minutes', value: '15m' },
  { label: 'Last 30 minutes', value: '30m' },
  { label: 'Last 1 hour', value: '1h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
]

const REFRESH_OPTIONS = [
  { label: 'Off', value: 'off' },
  { label: '5s', value: '5s' },
  { label: '15s', value: '15s' },
  { label: '30s', value: '30s' },
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
]

const title = ref(props.dashboard.title)
const description = ref(props.dashboard.description || '')
const timeRangePreset = ref(props.defaultSettings.timeRangePreset)
const refreshInterval = ref(props.defaultSettings.refreshInterval)
const variablesInput = ref(props.defaultSettings.variables.join(', '))
const activeTab = ref<'general' | 'yaml'>('general')
const isSaving = ref(false)
const isYamlSaving = ref(false)
const isYamlLoading = ref(false)
const isExporting = ref(false)
const isConvertingGrafana = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const yamlContent = ref('')
const originalYamlContent = ref('')
const yamlValidationError = ref<string | null>(null)
const grafanaSource = ref('')
const grafanaWarnings = ref<string[]>([])
const showGrafanaReplace = ref(false)

const TIME_RANGE_LOOKUP: Record<string, string> = {
  'now-5m|now': '5m',
  'now-15m|now': '15m',
  'now-30m|now': '30m',
  'now-1h|now': '1h',
  'now-6h|now': '6h',
  'now-24h|now': '24h',
  'now-7d|now': '7d',
}

const parsedVariables = computed(() => {
  return variablesInput.value
    .split(',')
    .map(variable => variable.trim())
    .filter(variable => variable.length > 0)
})

const yamlDirty = computed(() => yamlContent.value !== originalYamlContent.value)
const saveButtonLabel = computed(() => {
  if (activeTab.value === 'yaml') {
    return isYamlSaving.value ? 'Saving YAML...' : 'Save YAML'
  }
  return isSaving.value ? 'Saving...' : 'Save settings'
})

const yamlDiffPreview = computed(() => {
  if (!yamlDirty.value) {
    return [] as string[]
  }

  const originalLines = originalYamlContent.value.split('\n')
  const updatedLines = yamlContent.value.split('\n')
  const maxLength = Math.max(originalLines.length, updatedLines.length)
  const preview: string[] = []

  for (let index = 0; index < maxLength; index += 1) {
    const originalLine = originalLines[index]
    const updatedLine = updatedLines[index]
    if (originalLine === updatedLine) {
      continue
    }

    if (typeof originalLine === 'string') {
      preview.push(`- ${originalLine}`)
    }
    if (typeof updatedLine === 'string') {
      preview.push(`+ ${updatedLine}`)
    }

    if (preview.length >= 16) {
      break
    }
  }

  return preview
})

onMounted(() => {
  void loadYamlContent()
})

async function loadYamlContent() {
  isYamlLoading.value = true
  yamlValidationError.value = null

  try {
    const fileBlob = await exportDashboardYaml(props.dashboard.id)
    const content = await fileBlob.text()
    yamlContent.value = content
    originalYamlContent.value = content
  } catch (e) {
    yamlValidationError.value = e instanceof Error ? e.message : 'Failed to load dashboard YAML'
  } finally {
    isYamlLoading.value = false
  }
}

function normalizeYamlValue(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

function extractDashboardSection(rawYaml: string): string {
  const dashboardSectionMatch = rawYaml.match(/(?:^|\n)dashboard:\s*\n([\s\S]*)/)
  return dashboardSectionMatch?.[1] ?? ''
}

function validateYamlContent(rawYaml: string): string | null {
  if (!rawYaml.trim()) {
    return 'YAML content is required'
  }

  const schemaVersionMatch = rawYaml.match(/(?:^|\n)schema_version:\s*(\d+)/)
  if (!schemaVersionMatch) {
    return 'Missing schema_version'
  }
  if (schemaVersionMatch[1] !== '1') {
    return `Unsupported schema_version ${schemaVersionMatch[1]}`
  }

  const dashboardSection = extractDashboardSection(rawYaml)
  if (!dashboardSection) {
    return 'Missing dashboard section'
  }

  const titleMatch = dashboardSection.match(/(?:^|\n)\s{2}title:\s*(.+)/)
  if (!titleMatch || !normalizeYamlValue(titleMatch[1] ?? '')) {
    return 'Missing dashboard title'
  }

  const panelsMatch = dashboardSection.match(/(?:^|\n)\s{2}panels:\s*(?:\n|\[])/)
  if (!panelsMatch) {
    return 'Missing dashboard panels section'
  }

  return null
}

function extractVariables(rawYaml: string): string[] {
  const dashboardSection = extractDashboardSection(rawYaml)
  if (!dashboardSection) {
    return []
  }

  const variablesSectionMatch = dashboardSection.match(
    /(?:^|\n)\s{2}variables:\s*\n([\s\S]*?)(?=\n\s{2}[a-zA-Z_][\w-]*:\s*|\s*$)/,
  )

  const section = variablesSectionMatch?.[1] ?? ''
  const names = [...section.matchAll(/(?:^|\n)\s{4}-\s*name:\s*(.+)/g)]
    .map(match => normalizeYamlValue(match[1] ?? ''))
    .filter(name => name.length > 0)

  return names
}

function extractTimeRangePreset(rawYaml: string, fallback: string): string {
  const dashboardSection = extractDashboardSection(rawYaml)
  if (!dashboardSection) {
    return fallback
  }

  const fromMatch = dashboardSection.match(/(?:^|\n)\s{4}from:\s*(.+)/)
  const toMatch = dashboardSection.match(/(?:^|\n)\s{4}to:\s*(.+)/)

  const fromValue = normalizeYamlValue(fromMatch?.[1] ?? '')
  const toValue = normalizeYamlValue(toMatch?.[1] ?? '')
  if (!fromValue || !toValue) {
    return fallback
  }

  return TIME_RANGE_LOOKUP[`${fromValue}|${toValue}`] ?? fallback
}

function extractRefreshInterval(rawYaml: string, fallback: string): string {
  const dashboardSection = extractDashboardSection(rawYaml)
  if (!dashboardSection) {
    return fallback
  }

  const refreshMatch = dashboardSection.match(/(?:^|\n)\s{2}refresh_interval:\s*(.+)/)
  const value = normalizeYamlValue(refreshMatch?.[1] ?? '')
  return REFRESH_OPTIONS.some(option => option.value === value) ? value : fallback
}

function extractTitleAndDescription(rawYaml: string): { title: string; description: string } {
  const dashboardSection = extractDashboardSection(rawYaml)
  const titleMatch = dashboardSection.match(/(?:^|\n)\s{2}title:\s*(.+)/)
  const descriptionMatch = dashboardSection.match(/(?:^|\n)\s{2}description:\s*(.+)/)

  return {
    title: normalizeYamlValue(titleMatch?.[1] ?? props.dashboard.title),
    description: normalizeYamlValue(descriptionMatch?.[1] ?? ''),
  }
}

async function handleSubmit() {
  if (activeTab.value === 'yaml') {
    await saveYamlSettings()
    return
  }

  await saveSettings()
}

async function saveSettings() {
  if (!props.canEdit || isSaving.value) {
    return
  }

  if (!title.value.trim()) {
    error.value = 'Dashboard name is required'
    return
  }

  isSaving.value = true
  error.value = null
  successMessage.value = null

  try {
    await updateDashboard(props.dashboard.id, {
      title: title.value.trim(),
      description: description.value.trim() || undefined,
    })

    emit('saved', {
      title: title.value.trim(),
      description: description.value.trim(),
      settings: {
        timeRangePreset: timeRangePreset.value,
        refreshInterval: refreshInterval.value,
        variables: parsedVariables.value,
      },
    })

    successMessage.value = 'Dashboard settings saved'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save dashboard settings'
  } finally {
    isSaving.value = false
  }
}

async function saveYamlSettings() {
  if (!props.canEdit || isYamlSaving.value) {
    return
  }

  yamlValidationError.value = validateYamlContent(yamlContent.value)
  if (yamlValidationError.value) {
    return
  }

  const { title: nextTitle, description: nextDescription } = extractTitleAndDescription(yamlContent.value)
  if (!nextTitle.trim()) {
    yamlValidationError.value = 'Dashboard title is required'
    return
  }

  isYamlSaving.value = true
  error.value = null
  successMessage.value = null

  try {
    await updateDashboard(props.dashboard.id, {
      title: nextTitle,
      description: nextDescription || undefined,
    })

    const yamlSettings = {
      timeRangePreset: extractTimeRangePreset(yamlContent.value, timeRangePreset.value),
      refreshInterval: extractRefreshInterval(yamlContent.value, refreshInterval.value),
      variables: extractVariables(yamlContent.value),
    }

    emit('saved', {
      title: nextTitle,
      description: nextDescription,
      settings: yamlSettings,
    })

    originalYamlContent.value = yamlContent.value
    yamlValidationError.value = null
    successMessage.value = 'Dashboard YAML saved'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save dashboard YAML'
  } finally {
    isYamlSaving.value = false
  }
}

async function replaceWithGrafana() {
  if (!grafanaSource.value.trim() || isConvertingGrafana.value) {
    return
  }

  isConvertingGrafana.value = true
  error.value = null
  yamlValidationError.value = null

  try {
    const response = await convertGrafanaDashboard(grafanaSource.value, 'yaml')
    yamlContent.value = response.content
    grafanaWarnings.value = response.warnings
    const validationError = validateYamlContent(response.content)
    yamlValidationError.value = validationError
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to convert Grafana dashboard'
  } finally {
    isConvertingGrafana.value = false
  }
}

function fileNameFromTitle(titleValue: string): string {
  const normalized = titleValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${normalized || 'dashboard'}.yaml`
}

async function exportSettings() {
  if (isExporting.value) {
    return
  }

  isExporting.value = true
  error.value = null
  successMessage.value = null

  try {
    const fileBlob = await exportDashboardYaml(props.dashboard.id)
    const objectUrl = URL.createObjectURL(fileBlob)
    const link = document.createElement('a')

    link.href = objectUrl
    link.download = fileNameFromTitle(props.dashboard.title)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)

    successMessage.value = 'Dashboard export downloaded'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to export dashboard'
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <header class="modal-header">
        <div class="header-title">
          <Settings :size="18" />
          <h2>Dashboard Settings</h2>
        </div>
        <button class="btn-close" @click="emit('close')" type="button" aria-label="Close settings">
          <X :size="18" />
        </button>
      </header>

      <p v-if="!canEdit" class="viewer-note">
        You have view-only access. Settings are visible, but only editors and admins can save changes.
      </p>

      <form class="settings-form" @submit.prevent="handleSubmit">
        <div class="tab-nav" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            class="tab-button"
            :class="{ active: activeTab === 'general' }"
            :disabled="isSaving || isYamlSaving"
            data-testid="settings-tab-general"
            @click="activeTab = 'general'"
          >
            General
          </button>
          <button
            type="button"
            class="tab-button"
            :class="{ active: activeTab === 'yaml' }"
            :disabled="isSaving || isYamlSaving"
            data-testid="settings-tab-yaml"
            @click="activeTab = 'yaml'"
          >
            YAML Editor
          </button>
        </div>

        <template v-if="activeTab === 'general'">
          <section class="settings-section">
            <h3>General</h3>
            <label for="dashboard-name">Name</label>
            <input
              id="dashboard-name"
              v-model="title"
              type="text"
              :disabled="!canEdit || isSaving"
              autocomplete="off"
            />

            <label for="dashboard-description">Description</label>
            <textarea
              id="dashboard-description"
              v-model="description"
              rows="3"
              :disabled="!canEdit || isSaving"
              placeholder="Optional dashboard description"
            ></textarea>
          </section>

          <section class="settings-section">
            <h3>Defaults</h3>
            <label for="dashboard-time-range">Default time range</label>
            <select id="dashboard-time-range" v-model="timeRangePreset" :disabled="!canEdit || isSaving">
              <option v-for="option in TIME_RANGE_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>

            <label for="dashboard-refresh">Refresh interval</label>
            <select id="dashboard-refresh" v-model="refreshInterval" :disabled="!canEdit || isSaving">
              <option v-for="option in REFRESH_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </section>

          <section class="settings-section">
            <h3>Variables</h3>
            <label for="dashboard-variables">Variable names (comma-separated)</label>
            <input
              id="dashboard-variables"
              v-model="variablesInput"
              type="text"
              :disabled="!canEdit || isSaving"
              placeholder="env, cluster, instance"
            />
          </section>
        </template>

        <template v-else>
          <section class="settings-section yaml-section">
            <div class="yaml-section-header">
              <h3>Dashboard YAML</h3>
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="isConvertingGrafana || isYamlSaving"
                data-testid="grafana-replace-toggle"
                @click="showGrafanaReplace = !showGrafanaReplace"
              >
                {{ showGrafanaReplace ? 'Hide Grafana replace' : 'Replace with Grafana' }}
              </button>
            </div>

            <p class="yaml-hint">
              Edit dashboard YAML directly. Validation runs as you type and shows required schema fields.
            </p>

            <p v-if="isYamlLoading" class="yaml-hint">Loading current dashboard YAML...</p>

            <textarea
              v-else
              v-model="yamlContent"
              class="yaml-editor"
              data-testid="yaml-editor-input"
              spellcheck="false"
              :readonly="!canEdit || isYamlSaving"
              @input="yamlValidationError = validateYamlContent(yamlContent)"
            ></textarea>

            <div v-if="showGrafanaReplace" class="grafana-replace" data-testid="grafana-replace-panel">
              <label for="grafana-replace-source">Grafana JSON</label>
              <textarea
                id="grafana-replace-source"
                v-model="grafanaSource"
                rows="5"
                placeholder="Paste Grafana dashboard JSON"
                data-testid="grafana-source"
                :disabled="isConvertingGrafana || isYamlSaving"
              ></textarea>
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="!grafanaSource.trim() || isConvertingGrafana || isYamlSaving"
                data-testid="grafana-replace-convert"
                @click="replaceWithGrafana"
              >
                {{ isConvertingGrafana ? 'Converting...' : 'Convert to YAML' }}
              </button>
              <ul v-if="grafanaWarnings.length" class="warning-list" data-testid="grafana-warnings">
                <li v-for="warning in grafanaWarnings" :key="warning">{{ warning }}</li>
              </ul>
            </div>

            <div v-if="yamlDiffPreview.length" class="diff-preview" data-testid="yaml-diff-preview">
              <h4>Diff preview</h4>
              <pre>{{ yamlDiffPreview.join('\n') }}</pre>
            </div>
          </section>
        </template>

        <p v-if="error" class="error-message">{{ error }}</p>
        <p v-if="yamlValidationError" class="error-message" data-testid="yaml-validation-error">
          {{ yamlValidationError }}
        </p>
        <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary btn-export" :disabled="isExporting" @click="exportSettings">
            <Download :size="14" />
            <span>{{ isExporting ? 'Exporting...' : 'Export YAML' }}</span>
          </button>
          <button type="button" class="btn btn-secondary" @click="emit('close')">Close</button>
          <button v-if="canEdit" type="submit" class="btn btn-primary" :disabled="isSaving || isYamlSaving">
            {{ saveButtonLabel }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(3, 10, 18, 0.76);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 120;
}

.modal {
  width: min(640px, calc(100vw - 1.5rem));
  max-height: calc(100vh - 2rem);
  overflow: auto;
  background: var(--surface-1);
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.1rem;
  border-bottom: 1px solid var(--border-primary);
}

.header-title {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}

.header-title h2 {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.btn-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.btn-close:hover {
  border-color: var(--border-primary);
  background: var(--bg-hover);
  color: var(--text-primary);
}

.viewer-note {
  margin: 0;
  padding: 0.75rem 1.1rem;
  border-bottom: 1px solid var(--border-primary);
  background: rgba(125, 211, 252, 0.08);
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.settings-form {
  padding: 1rem 1.1rem 1.1rem;
}

.tab-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
  margin-bottom: 0.9rem;
}

.tab-button {
  border: 1px solid var(--border-primary);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 8px;
  padding: 0.52rem 0.68rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.tab-button.active {
  border-color: var(--accent-primary);
  background: rgba(56, 189, 248, 0.12);
  color: var(--text-primary);
}

.tab-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.settings-section {
  margin-bottom: 1rem;
  padding: 0.9rem;
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  background: var(--surface-2);
  display: grid;
  gap: 0.55rem;
}

.settings-section h3 {
  margin: 0 0 0.25rem;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.yaml-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
}

.yaml-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.yaml-editor {
  min-height: 280px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.78rem;
  line-height: 1.5;
}

.grafana-replace {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 0.7rem;
  background: var(--surface-1);
  display: grid;
  gap: 0.55rem;
}

.warning-list {
  margin: 0;
  padding-left: 1.1rem;
  color: #facc15;
  font-size: 0.78rem;
}

.diff-preview {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 0.7rem;
  background: rgba(148, 163, 184, 0.08);
}

.diff-preview h4 {
  margin: 0 0 0.45rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.diff-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.74rem;
  line-height: 1.45;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

label {
  font-size: 0.82rem;
  color: var(--text-primary);
}

input,
textarea,
select {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-primary);
  background: var(--surface-1);
  color: var(--text-primary);
}

input:disabled,
textarea:disabled,
select:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-message,
.success-message {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  font-size: 0.82rem;
}

.error-message {
  border: 1px solid rgba(255, 107, 107, 0.3);
  background: rgba(255, 107, 107, 0.1);
  color: var(--accent-danger);
}

.success-message {
  border: 1px solid rgba(78, 205, 196, 0.3);
  background: rgba(78, 205, 196, 0.1);
  color: var(--accent-success);
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.7rem;
}

.btn-export {
  gap: 0.4rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.58rem 0.9rem;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn-secondary {
  background: var(--bg-tertiary);
  border-color: var(--border-primary);
  color: var(--text-primary);
}

.btn-primary {
  background: var(--accent-primary);
  color: white;
}
</style>

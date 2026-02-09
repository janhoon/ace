<script setup lang="ts">
import { computed, ref } from 'vue'
import { Settings, X } from 'lucide-vue-next'
import { updateDashboard } from '../api/dashboards'
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
const isSaving = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const parsedVariables = computed(() => {
  return variablesInput.value
    .split(',')
    .map(variable => variable.trim())
    .filter(variable => variable.length > 0)
})

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

      <form class="settings-form" @submit.prevent="saveSettings">
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

        <p v-if="error" class="error-message">{{ error }}</p>
        <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="emit('close')">Close</button>
          <button v-if="canEdit" type="submit" class="btn btn-primary" :disabled="isSaving">
            {{ isSaving ? 'Saving...' : 'Save settings' }}
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
  justify-content: flex-end;
  gap: 0.7rem;
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

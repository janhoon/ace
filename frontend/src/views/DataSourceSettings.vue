<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Plus, Trash2, Pencil, Database, X, Check, ExternalLink, HeartPulse, CircleAlert, Loader2 } from 'lucide-vue-next'
import { useOrganization } from '../composables/useOrganization'
import { useDatasource } from '../composables/useDatasource'
import { testDataSourceConnection } from '../api/datasources'
import type { DataSource, DataSourceType, CreateDataSourceRequest } from '../types/datasource'
import { dataSourceTypeLabels, isTracingType } from '../types/datasource'
import prometheusLogo from '../assets/datasources/prometheus-logo.svg'
import lokiLogo from '../assets/datasources/loki-logo.svg'
import victoriaMetricsLogo from '../assets/datasources/victoriametrics-logo.svg'
import victoriaLogsLogo from '../assets/datasources/victorialogs-logo.svg'
import tempoLogo from '../assets/datasources/tempo-logo.svg'
import victoriaTracesLogo from '../assets/datasources/victoriatraces-logo.svg'

const { currentOrg } = useOrganization()
const {
  datasources,
  loading,
  error,
  fetchDatasources,
  addDatasource,
  editDatasource,
  removeDatasource,
} = useDatasource()

const showModal = ref(false)
const editingDs = ref<DataSource | null>(null)

// Form state
const formName = ref('')
const formType = ref<DataSourceType>('prometheus')
const formUrl = ref('')
const formIsDefault = ref(false)
const formAuthType = ref<'none' | 'basic' | 'bearer' | 'api_key'>('none')
const formBasicUsername = ref('')
const formBasicPassword = ref('')
const formBearerToken = ref('')
const formApiKeyHeader = ref('X-API-Key')
const formApiKeyValue = ref('')
const formError = ref<string | null>(null)
const formLoading = ref(false)
const testAllLoading = ref(false)
const healthStatus = ref<Record<string, 'unknown' | 'checking' | 'healthy' | 'unhealthy'>>({})
const healthErrors = ref<Record<string, string>>({})

const isEditing = computed(() => !!editingDs.value)

const dataSourceTypeLogos: Record<DataSourceType, string> = {
  prometheus: prometheusLogo,
  loki: lokiLogo,
  victoriametrics: victoriaMetricsLogo,
  victorialogs: victoriaLogsLogo,
  tempo: tempoLogo,
  victoriatraces: victoriaTracesLogo,
}

const showAuthSettings = computed(() => isTracingType(formType.value))

function openCreateModal() {
  editingDs.value = null
  formName.value = ''
  formType.value = 'prometheus'
  formUrl.value = ''
  formIsDefault.value = false
  resetAuthForm()
  formError.value = null
  showModal.value = true
}

function openEditModal(ds: DataSource) {
  editingDs.value = ds
  formName.value = ds.name
  formType.value = ds.type
  formUrl.value = ds.url
  formIsDefault.value = ds.is_default
  hydrateAuthForm(ds)
  formError.value = null
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingDs.value = null
}

function resetAuthForm() {
  formAuthType.value = 'none'
  formBasicUsername.value = ''
  formBasicPassword.value = ''
  formBearerToken.value = ''
  formApiKeyHeader.value = 'X-API-Key'
  formApiKeyValue.value = ''
}

function hydrateAuthForm(ds: DataSource) {
  resetAuthForm()

  const authType = (ds.auth_type || 'none') as 'none' | 'basic' | 'bearer' | 'api_key'
  formAuthType.value = authType

  const authConfig = ds.auth_config || {}
  const username = authConfig.username
  const password = authConfig.password
  const token = authConfig.token
  const header = authConfig.header
  const value = authConfig.value

  if (typeof username === 'string') {
    formBasicUsername.value = username
  }
  if (typeof password === 'string') {
    formBasicPassword.value = password
  }
  if (typeof token === 'string') {
    formBearerToken.value = token
  }
  if (typeof header === 'string' && header.trim() !== '') {
    formApiKeyHeader.value = header
  }
  if (typeof value === 'string') {
    formApiKeyValue.value = value
  }
}

function getHealthStatus(dsId: string) {
  return healthStatus.value[dsId] || 'unknown'
}

function getHealthLabel(dsId: string) {
  const status = getHealthStatus(dsId)
  if (status === 'healthy') return 'Healthy'
  if (status === 'unhealthy') return 'Unhealthy'
  if (status === 'checking') return 'Checking...'
  return 'Unknown'
}

async function testDatasource(ds: DataSource) {
  healthStatus.value[ds.id] = 'checking'
  delete healthErrors.value[ds.id]

  try {
    await testDataSourceConnection(ds.id)

    healthStatus.value[ds.id] = 'healthy'
  } catch (e) {
    healthStatus.value[ds.id] = 'unhealthy'
    healthErrors.value[ds.id] = e instanceof Error ? e.message : 'Connection test failed'
  }
}

async function testAllDatasources() {
  testAllLoading.value = true
  try {
    for (const ds of datasources.value) {
      await testDatasource(ds)
    }
  } finally {
    testAllLoading.value = false
  }
}

function buildAuthPayload() {
  if (!showAuthSettings.value || formAuthType.value === 'none') {
    return {
      auth_type: 'none' as const,
      auth_config: undefined,
    }
  }

  if (formAuthType.value === 'basic') {
    if (!formBasicUsername.value.trim()) {
      throw new Error('Basic auth username is required')
    }

    return {
      auth_type: 'basic' as const,
      auth_config: {
        username: formBasicUsername.value.trim(),
        password: formBasicPassword.value,
      },
    }
  }

  if (formAuthType.value === 'bearer') {
    if (!formBearerToken.value.trim()) {
      throw new Error('Bearer token is required')
    }

    return {
      auth_type: 'bearer' as const,
      auth_config: {
        token: formBearerToken.value.trim(),
      },
    }
  }

  if (!formApiKeyValue.value.trim()) {
    throw new Error('API key value is required')
  }

  return {
    auth_type: 'api_key' as const,
    auth_config: {
      header: formApiKeyHeader.value.trim() || 'X-API-Key',
      value: formApiKeyValue.value.trim(),
    },
  }
}

async function handleSubmit() {
  if (!formName.value.trim()) {
    formError.value = 'Name is required'
    return
  }
  if (!formUrl.value.trim()) {
    formError.value = 'URL is required'
    return
  }

  formLoading.value = true
  formError.value = null

  try {
    const authPayload = buildAuthPayload()

    if (isEditing.value && editingDs.value) {
      await editDatasource(editingDs.value.id, {
        name: formName.value.trim(),
        type: formType.value,
        url: formUrl.value.trim(),
        is_default: formIsDefault.value,
        auth_type: authPayload.auth_type,
        auth_config: authPayload.auth_config,
      })
    } else if (currentOrg.value) {
      await addDatasource(currentOrg.value.id, {
        name: formName.value.trim(),
        type: formType.value,
        url: formUrl.value.trim(),
        is_default: formIsDefault.value,
        auth_type: authPayload.auth_type,
        auth_config: authPayload.auth_config,
      } as CreateDataSourceRequest)
    }
    closeModal()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Operation failed'
  } finally {
    formLoading.value = false
  }
}

async function handleDelete(ds: DataSource) {
  if (!confirm(`Delete datasource "${ds.name}"? This cannot be undone.`)) return
  try {
    await removeDatasource(ds.id)
  } catch {
    // error is set by composable
  }
}

function getTypeColor(type_: DataSourceType): string {
  switch (type_) {
    case 'prometheus':
      return '#e6522c'
    case 'loki':
      return '#f9a825'
    case 'victorialogs':
      return '#6ec6ff'
    case 'victoriametrics':
      return '#59a14f'
    case 'tempo':
      return '#8f6dff'
    case 'victoriatraces':
      return '#5bc0be'
  }
}

function getTypeLogo(type_: DataSourceType): string {
  return dataSourceTypeLogos[type_]
}

onMounted(() => {
  if (currentOrg.value) {
    fetchDatasources(currentOrg.value.id)
  }
})

watch(
  () => currentOrg.value?.id,
  (orgId, prevOrgId) => {
    if (orgId && orgId !== prevOrgId) {
      fetchDatasources(orgId)
    }
  },
)
</script>

<template>
  <div class="datasource-settings">
    <header class="page-header">
      <div>
        <h1>Data Sources</h1>
        <p class="page-subtitle">Manage connections to your monitoring systems</p>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-secondary btn-header btn-test-all"
          :disabled="datasources.length === 0 || testAllLoading"
          @click="testAllDatasources"
        >
          <Loader2 v-if="testAllLoading" :size="16" class="icon-spin" />
          <HeartPulse v-else :size="16" />
          {{ testAllLoading ? 'Testing...' : 'Test All' }}
        </button>
        <button class="btn btn-primary btn-header" @click="openCreateModal">
          <Plus :size="16" />
          Add Data Source
        </button>
      </div>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div v-if="loading && datasources.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading datasources...</p>
    </div>

    <div v-else-if="datasources.length === 0" class="empty-state">
      <Database :size="48" class="empty-icon" />
      <h3>No data sources configured</h3>
      <p>Add a data source to start querying your monitoring systems.</p>
      <button class="btn btn-primary" @click="openCreateModal">
        <Plus :size="16" />
        Add Data Source
      </button>
    </div>

    <div v-else class="datasource-grid">
      <div
        v-for="ds in datasources"
        :key="ds.id"
        class="datasource-card"
      >
        <div class="card-header">
          <div class="card-title-row">
            <div
              class="type-panel"
              :style="{ borderColor: getTypeColor(ds.type) + '4d', background: getTypeColor(ds.type) + '14' }"
            >
              <img :src="getTypeLogo(ds.type)" :alt="`${dataSourceTypeLabels[ds.type]} logo`" class="type-panel-logo" />
              <div class="type-panel-meta">
                <span class="type-panel-label">Source Type</span>
                <strong class="type-panel-name">{{ dataSourceTypeLabels[ds.type] }}</strong>
              </div>
            </div>
            <span v-if="ds.is_default" class="default-badge">
              <Check :size="12" />
              Default
            </span>
          </div>
          <div class="card-actions">
            <button class="btn-icon" @click="openEditModal(ds)" title="Edit">
              <Pencil :size="16" />
            </button>
            <button class="btn-icon btn-icon-danger" @click="handleDelete(ds)" title="Delete">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="card-main">
            <h3 class="ds-name">{{ ds.name }}</h3>
            <div class="ds-url">
              <ExternalLink :size="14" />
              <span>{{ ds.url }}</span>
            </div>
          </div>
          <div class="card-footer">
            <span
              class="health-badge"
              :class="`health-${getHealthStatus(ds.id)}`"
              :title="healthErrors[ds.id] || getHealthLabel(ds.id)"
            >
              <Loader2 v-if="getHealthStatus(ds.id) === 'checking'" :size="12" class="icon-spin" />
              <HeartPulse v-else-if="getHealthStatus(ds.id) === 'healthy'" :size="12" />
              <CircleAlert v-else-if="getHealthStatus(ds.id) === 'unhealthy'" :size="12" />
              <span>{{ getHealthLabel(ds.id) }}</span>
            </span>

            <button
              class="btn btn-secondary btn-test"
              :disabled="getHealthStatus(ds.id) === 'checking'"
              @click="testDatasource(ds)"
              title="Run connection test"
            >
              <Loader2 v-if="getHealthStatus(ds.id) === 'checking'" :size="14" class="icon-spin" />
              <HeartPulse v-else :size="14" />
              {{ getHealthStatus(ds.id) === 'checking' ? 'Testing...' : 'Test' }}
            </button>
          </div>
          <div v-if="healthErrors[ds.id]" class="health-error">{{ healthErrors[ds.id] }}</div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <header class="modal-header">
          <h2>{{ isEditing ? 'Edit Data Source' : 'Add Data Source' }}</h2>
          <button class="btn-close" @click="closeModal">
            <X :size="20" />
          </button>
        </header>

        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="ds-name">Name <span class="required">*</span></label>
            <input
              id="ds-name"
              v-model="formName"
              type="text"
              placeholder="My Prometheus"
              :disabled="formLoading"
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label for="ds-type">Type</label>
            <select id="ds-type" v-model="formType" :disabled="formLoading">
              <option value="prometheus">Prometheus (PromQL)</option>
              <option value="victoriametrics">VictoriaMetrics (PromQL)</option>
              <option value="loki">Loki (LogQL)</option>
              <option value="victorialogs">Victoria Logs (LogsQL)</option>
              <option value="tempo">Tempo (Tracing)</option>
              <option value="victoriatraces">VictoriaTraces (Tracing)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="ds-url">URL <span class="required">*</span></label>
            <input
              id="ds-url"
              v-model="formUrl"
              type="text"
              placeholder="http://localhost:9090"
              :disabled="formLoading"
              autocomplete="off"
            />
          </div>

          <div v-if="showAuthSettings" class="form-auth-section">
            <div class="form-group">
              <label for="ds-auth-type">Authentication</label>
              <select id="ds-auth-type" v-model="formAuthType" :disabled="formLoading">
                <option value="none">None</option>
                <option value="basic">Basic auth</option>
                <option value="bearer">Bearer token</option>
                <option value="api_key">API key</option>
              </select>
            </div>

            <div v-if="formAuthType === 'basic'" class="auth-grid">
              <div class="form-group">
                <label for="ds-basic-username">Username <span class="required">*</span></label>
                <input
                  id="ds-basic-username"
                  v-model="formBasicUsername"
                  type="text"
                  :disabled="formLoading"
                  autocomplete="off"
                />
              </div>
              <div class="form-group">
                <label for="ds-basic-password">Password</label>
                <input
                  id="ds-basic-password"
                  v-model="formBasicPassword"
                  type="password"
                  :disabled="formLoading"
                  autocomplete="new-password"
                />
              </div>
            </div>

            <div v-else-if="formAuthType === 'bearer'" class="form-group">
              <label for="ds-bearer-token">Bearer token <span class="required">*</span></label>
              <input
                id="ds-bearer-token"
                v-model="formBearerToken"
                type="password"
                :disabled="formLoading"
                autocomplete="new-password"
              />
            </div>

            <div v-else-if="formAuthType === 'api_key'" class="auth-grid">
              <div class="form-group">
                <label for="ds-api-header">Header name</label>
                <input
                  id="ds-api-header"
                  v-model="formApiKeyHeader"
                  type="text"
                  :disabled="formLoading"
                  autocomplete="off"
                />
              </div>
              <div class="form-group">
                <label for="ds-api-value">API key <span class="required">*</span></label>
                <input
                  id="ds-api-value"
                  v-model="formApiKeyValue"
                  type="password"
                  :disabled="formLoading"
                  autocomplete="new-password"
                />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="formIsDefault" :disabled="formLoading" />
              Set as default data source
            </label>
          </div>

          <div v-if="formError" class="error-message">{{ formError }}</div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="closeModal" :disabled="formLoading">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="formLoading">
              {{ formLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Data Source' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.datasource-settings {
  padding: 1.25rem 1.5rem;
  max-width: 1120px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem 1.15rem;
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  background: var(--surface-1);
  box-shadow: var(--shadow-sm);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.btn-header {
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  border-radius: 10px;
}

.btn-test-all {
  min-width: 96px;
}

.page-header h1 {
  font-size: 1.03rem;
  font-weight: 700;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0.25rem 0 0;
}

.error-banner {
  padding: 0.75rem 1rem;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 8px;
  color: var(--accent-danger);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  gap: 1rem;
}

.empty-icon {
  color: var(--text-tertiary);
}

.empty-state h3 {
  margin: 0;
  font-size: 1.125rem;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-primary);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.datasource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.datasource-card {
  background: linear-gradient(180deg, rgba(16, 27, 42, 0.92), rgba(13, 23, 36, 0.9));
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  box-shadow: var(--shadow-sm);
}

.datasource-card:hover {
  border-color: rgba(56, 189, 248, 0.35);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem 1rem 0;
  gap: 0.75rem;
}

.card-title-row {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.625rem;
  min-width: 0;
}

.type-panel {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.4rem 0.85rem;
  border-radius: 11px;
  border: 1px solid;
  min-width: 0;
}

.type-panel-logo {
  width: 26px;
  height: 26px;
  object-fit: contain;
  flex-shrink: 0;
}

.type-panel-meta {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
}

.type-panel-label {
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.type-panel-name {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.default-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  background: rgba(56, 189, 248, 0.16);
  color: var(--accent-primary);
}

.card-actions {
  display: flex;
  gap: 0.25rem;
}

.card-body {
  padding: 0.875rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-main {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ds-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.ds-url {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.78rem;
  color: var(--text-tertiary);
  word-break: break-all;
  padding: 0.45rem 0.6rem;
  border-radius: 7px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.health-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  font-size: 0.72rem;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
}

.health-unknown {
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-color: var(--border-primary);
}

.health-checking {
  color: #6ec6ff;
  background: rgba(110, 198, 255, 0.12);
  border-color: rgba(110, 198, 255, 0.35);
}

.health-healthy {
  color: #59a14f;
  background: rgba(89, 161, 79, 0.12);
  border-color: rgba(89, 161, 79, 0.35);
}

.health-unhealthy {
  color: var(--accent-danger);
  background: rgba(255, 107, 107, 0.12);
  border-color: rgba(255, 107, 107, 0.35);
}

.btn-test {
  padding: 0.28rem 0.55rem;
  font-size: 0.72rem;
  border-radius: 999px;
  min-height: 28px;
  line-height: 1;
}

.health-error {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--accent-danger);
  line-height: 1.4;
}

.icon-spin {
  animation: spin 0.8s linear infinite;
}

@media (max-width: 840px) {
  .datasource-settings {
    padding: 0.9rem;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .auth-grid {
    grid-template-columns: 1fr;
  }
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-icon-danger:hover {
  background: rgba(251, 113, 133, 0.15);
  color: var(--accent-danger);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(3, 10, 18, 0.76);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--surface-1);
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-auth-section {
  padding: 0.85rem 0.95rem 0.1rem;
  margin-bottom: 1.1rem;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: rgba(24, 37, 54, 0.45);
}

.auth-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.required {
  color: var(--accent-danger);
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group select {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input::placeholder {
  color: var(--text-tertiary);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: var(--focus-ring);
}

.form-group select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a0a0a0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.error-message {
  padding: 0.75rem 1rem;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 6px;
  color: var(--accent-danger);
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-tertiary);
  border-color: var(--border-primary);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-primary {
  background: var(--accent-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-primary-hover);
}
</style>

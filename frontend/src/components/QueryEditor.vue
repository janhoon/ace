<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { queryPrometheus, type PrometheusQueryResult } from '../composables/useProm'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const query = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})

const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<PrometheusQueryResult | null>(null)
const showPreview = ref(false)

async function runQuery() {
  if (!query.value.trim()) {
    error.value = 'Query is required'
    return
  }

  loading.value = true
  error.value = null
  result.value = null

  try {
    // Use a 1-hour time range ending now for preview
    const end = Math.floor(Date.now() / 1000)
    const start = end - 3600
    const step = 15

    const response = await queryPrometheus(query.value, start, end, step)
    result.value = response

    if (response.status === 'error') {
      error.value = response.error || 'Query failed'
    } else {
      showPreview.value = true
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to execute query'
  } finally {
    loading.value = false
  }
}

// Reset results when query changes
watch(query, () => {
  error.value = null
  result.value = null
  showPreview.value = false
})

// Extract unique labels from results
const metricLabels = computed(() => {
  if (!result.value?.data?.result) return []

  const labelSet = new Set<string>()
  for (const metric of result.value.data.result) {
    for (const key of Object.keys(metric.metric)) {
      labelSet.add(key)
    }
  }
  return Array.from(labelSet).sort()
})

// Format results for preview table
const previewData = computed(() => {
  if (!result.value?.data?.result) return []

  return result.value.data.result.map((metric) => ({
    metric: metric.metric,
    latestValue: metric.values.length > 0
      ? metric.values[metric.values.length - 1][1]
      : 'N/A',
    valueCount: metric.values.length
  }))
})
</script>

<template>
  <div class="query-editor">
    <div class="query-input-group">
      <label for="promql-query">PromQL Query</label>
      <textarea
        id="promql-query"
        v-model="query"
        placeholder="up"
        rows="3"
        :disabled="disabled || loading"
        class="query-textarea"
        @keydown.ctrl.enter="runQuery"
      ></textarea>
      <div class="query-actions">
        <button
          type="button"
          class="btn btn-run"
          :disabled="disabled || loading || !query.trim()"
          @click="runQuery"
        >
          {{ loading ? 'Running...' : 'Run Query' }}
        </button>
        <span class="hint">Ctrl+Enter to run</span>
      </div>
    </div>

    <div v-if="error" class="query-error">
      {{ error }}
    </div>

    <div v-if="showPreview && result?.status === 'success'" class="query-preview">
      <div class="preview-header">
        <h4>Query Results</h4>
        <span class="result-count">{{ result.data?.result?.length || 0 }} series</span>
      </div>

      <div v-if="metricLabels.length > 0" class="labels-section">
        <strong>Labels:</strong>
        <span v-for="label in metricLabels" :key="label" class="label-tag">
          {{ label }}
        </span>
      </div>

      <div v-if="previewData.length > 0" class="preview-table-wrapper">
        <table class="preview-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Latest Value</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in previewData" :key="index">
              <td class="metric-cell">
                <code>{{ JSON.stringify(row.metric) }}</code>
              </td>
              <td>{{ row.latestValue }}</td>
              <td>{{ row.valueCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="no-data">
        No data returned for the selected time range.
      </div>
    </div>
  </div>
</template>

<style scoped>
.query-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.query-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.query-input-group label {
  font-weight: 500;
  color: #2c3e50;
}

.query-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  resize: vertical;
  box-sizing: border-box;
}

.query-textarea:focus {
  outline: none;
  border-color: #3498db;
}

.query-textarea:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.query-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-run {
  padding: 0.5rem 1rem;
  border: 1px solid #27ae60;
  border-radius: 4px;
  background: #27ae60;
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-run:hover:not(:disabled) {
  background: #219a52;
}

.btn-run:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint {
  font-size: 0.75rem;
  color: #999;
}

.query-error {
  padding: 0.75rem;
  background: #fdecea;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 0.875rem;
}

.query-preview {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.preview-header h4 {
  margin: 0;
  font-size: 0.875rem;
  color: #2c3e50;
}

.result-count {
  font-size: 0.75rem;
  color: #666;
}

.labels-section {
  padding: 0.75rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.875rem;
}

.label-tag {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: #e0e0e0;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.75rem;
}

.preview-table-wrapper {
  max-height: 200px;
  overflow-y: auto;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.preview-table th,
.preview-table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.preview-table th {
  background: #f8f9fa;
  font-weight: 500;
  position: sticky;
  top: 0;
}

.preview-table tr:last-child td {
  border-bottom: none;
}

.metric-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-cell code {
  font-size: 0.75rem;
}

.no-data {
  padding: 1rem;
  text-align: center;
  color: #666;
  font-size: 0.875rem;
}
</style>

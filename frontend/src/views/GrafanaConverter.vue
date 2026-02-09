<script setup lang="ts">
import { computed, ref } from 'vue'
import { convertGrafanaDashboard } from '../api/converter'

const selectedFormat = ref<'json' | 'yaml'>('json')
const sourceJson = ref('')
const resultContent = ref('')
const warnings = ref<string[]>([])
const loading = ref(false)
const error = ref('')

const canConvert = computed(() => sourceJson.value.trim().length > 0 && !loading.value)

function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  file.text()
    .then((text) => {
      sourceJson.value = text
    })
    .catch(() => {
      error.value = 'Failed to read selected file'
    })
}

async function convert() {
  if (!canConvert.value) {
    return
  }

  loading.value = true
  error.value = ''
  warnings.value = []

  try {
    const response = await convertGrafanaDashboard(sourceJson.value, selectedFormat.value)
    resultContent.value = response.content
    warnings.value = response.warnings
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to convert dashboard'
    resultContent.value = ''
  } finally {
    loading.value = false
  }
}

function downloadResult() {
  if (!resultContent.value) {
    return
  }

  const extension = selectedFormat.value === 'yaml' ? 'yaml' : 'json'
  const blob = new Blob([resultContent.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `dash-converted.${extension}`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="converter-page">
    <header class="page-header">
      <h1>Grafana Dashboard Converter</h1>
      <p>Upload Grafana JSON and convert it to Dash JSON or YAML format.</p>
    </header>

    <div class="controls">
      <label class="field">
        <span>Grafana JSON file</span>
        <input data-testid="grafana-file" type="file" accept=".json,application/json" @change="onFileSelected">
      </label>

      <label class="field">
        <span>Output format</span>
        <select v-model="selectedFormat" data-testid="format-select">
          <option value="json">JSON</option>
          <option value="yaml">YAML</option>
        </select>
      </label>

      <button data-testid="convert-button" class="primary" :disabled="!canConvert" @click="convert">
        {{ loading ? 'Converting...' : 'Convert dashboard' }}
      </button>
    </div>

    <label class="field editor">
      <span>Grafana JSON</span>
      <textarea
        v-model="sourceJson"
        data-testid="grafana-source"
        rows="12"
        placeholder="Paste Grafana dashboard JSON here"
      />
    </label>

    <p v-if="error" data-testid="convert-error" class="status error">{{ error }}</p>

    <ul v-if="warnings.length > 0" data-testid="convert-warnings" class="warnings">
      <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
    </ul>

    <section v-if="resultContent" class="result">
      <div class="result-header">
        <h2>Converted Dashboard</h2>
        <button data-testid="download-button" class="secondary" @click="downloadResult">Download</button>
      </div>
      <pre data-testid="convert-result">{{ resultContent }}</pre>
    </section>
  </section>
</template>

<style scoped>
.converter-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem;
  color: var(--text-primary);
}

.page-header h1 {
  margin: 0;
}

.controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field span {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  background: rgba(16, 27, 42, 0.85);
  color: var(--text-primary);
  padding: 0.7rem;
  font-family: var(--font-mono);
}

.editor textarea {
  min-height: 240px;
}

.primary,
.secondary {
  align-self: end;
  border: 1px solid var(--border-secondary);
  border-radius: 10px;
  padding: 0.65rem 1rem;
  cursor: pointer;
  color: var(--text-primary);
}

.primary {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: #052433;
  font-weight: 600;
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary {
  background: rgba(25, 40, 58, 0.9);
}

.status.error {
  color: #fecaca;
}

.warnings {
  margin: 0.75rem 0 0;
  padding-left: 1.25rem;
  color: #fde68a;
}

.result {
  margin-top: 1.25rem;
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  background: rgba(14, 24, 37, 0.9);
  overflow: hidden;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border-primary);
}

pre {
  margin: 0;
  padding: 1rem;
  overflow: auto;
  max-height: 360px;
}

@media (max-width: 900px) {
  .converter-page {
    padding: 1rem;
  }

  .controls {
    grid-template-columns: 1fr;
  }

  .primary {
    width: 100%;
  }
}
</style>

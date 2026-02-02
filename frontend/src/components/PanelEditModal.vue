<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Panel } from '../types/panel'
import { createPanel, updatePanel } from '../api/panels'

const props = defineProps<{
  panel?: Panel
  dashboardId: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const isEditing = computed(() => !!props.panel)

const title = ref(props.panel?.title || '')
const panelType = ref(props.panel?.type || 'line_chart')
const queryStr = ref(props.panel?.query ? JSON.stringify(props.panel.query, null, 2) : '')
const loading = ref(false)
const error = ref<string | null>(null)

async function handleSubmit() {
  if (!title.value.trim()) {
    error.value = 'Title is required'
    return
  }

  let query: Record<string, unknown> | undefined
  if (queryStr.value.trim()) {
    try {
      query = JSON.parse(queryStr.value.trim())
    } catch {
      error.value = 'Invalid JSON in query field'
      return
    }
  }

  loading.value = true
  error.value = null

  try {
    if (isEditing.value && props.panel) {
      await updatePanel(props.panel.id, {
        title: title.value.trim(),
        type: panelType.value,
        query
      })
    } else {
      await createPanel(props.dashboardId, {
        title: title.value.trim(),
        type: panelType.value,
        grid_pos: { x: 0, y: 0, w: 6, h: 4 },
        query
      })
    }
    emit('saved')
  } catch {
    error.value = isEditing.value ? 'Failed to update panel' : 'Failed to create panel'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <header class="modal-header">
        <h2>{{ isEditing ? 'Edit Panel' : 'Add Panel' }}</h2>
        <button class="btn-close" @click="emit('close')">&times;</button>
      </header>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="title">Title *</label>
          <input
            id="title"
            v-model="title"
            type="text"
            placeholder="Panel title"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="type">Panel Type</label>
          <select id="type" v-model="panelType" :disabled="loading">
            <option value="line_chart">Line Chart</option>
            <option value="bar_chart">Bar Chart</option>
            <option value="gauge">Gauge</option>
            <option value="stat">Stat</option>
            <option value="table">Table</option>
          </select>
        </div>

        <div class="form-group">
          <label for="query">Query (JSON)</label>
          <textarea
            id="query"
            v-model="queryStr"
            placeholder='{"promql": "up"}'
            rows="4"
            :disabled="loading"
          ></textarea>
        </div>

        <div v-if="error" class="error">{{ error }}</div>

        <div class="modal-actions">
          <button type="button" class="btn" @click="emit('close')" :disabled="loading">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Saving...' : (isEditing ? 'Save' : 'Add Panel') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: white;
  border-radius: 8px;
  padding: 0;
  width: 100%;
  max-width: 480px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  color: #2c3e50;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #999;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.btn-close:hover {
  color: #666;
}

form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

.form-group textarea {
  font-family: monospace;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #3498db;
}

.error {
  color: #e74c3c;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn:hover:not(:disabled) {
  background: #f5f5f5;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3498db;
  border-color: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}
</style>

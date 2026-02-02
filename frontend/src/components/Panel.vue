<script setup lang="ts">
import type { Panel } from '../types/panel'

defineProps<{
  panel: Panel
}>()

defineEmits<{
  edit: [panel: Panel]
  delete: [panel: Panel]
}>()
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h3 class="panel-title">{{ panel.title }}</h3>
      <div class="panel-actions">
        <button class="btn btn-icon" @click="$emit('edit', panel)" title="Edit">
          Edit
        </button>
        <button class="btn btn-icon btn-danger" @click="$emit('delete', panel)" title="Delete">
          X
        </button>
      </div>
    </div>
    <div class="panel-content">
      <slot>
        <div class="panel-placeholder">
          <span class="panel-type">{{ panel.type }}</span>
          <p>Panel content will be rendered here</p>
        </div>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 150px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.panel-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #2c3e50;
}

.panel-actions {
  display: flex;
  gap: 0.25rem;
}

.btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.75rem;
}

.btn:hover {
  background: #f5f5f5;
}

.btn-icon {
  padding: 0.25rem 0.5rem;
}

.btn-danger {
  color: #e74c3c;
  border-color: #e74c3c;
}

.btn-danger:hover {
  background: #fdf2f2;
}

.panel-content {
  flex: 1;
  padding: 1rem;
  overflow: auto;
}

.panel-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  text-align: center;
}

.panel-type {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #e0e0e0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.panel-placeholder p {
  margin: 0;
  font-size: 0.875rem;
}
</style>

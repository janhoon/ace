<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'
import { ref } from 'vue'
import type { DashboardVariable } from '../composables/useVariables'

const props = defineProps<{
  variables: DashboardVariable[]
}>()

const emit = defineEmits<{
  'update:value': [payload: { name: string; value: string | string[] }]
}>()

// Track which multi-select popover is open
const openMultiSelect = ref<string | null>(null)

function handleSingleChange(variable: DashboardVariable, event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:value', { name: variable.name, value: target.value })
}

function handleTextChange(variable: DashboardVariable, event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:value', { name: variable.name, value: target.value })
}

function toggleMultiSelect(name: string) {
  openMultiSelect.value = openMultiSelect.value === name ? null : name
}

function toggleMultiOption(variable: DashboardVariable, option: string) {
  const current = Array.isArray(variable.current) ? [...variable.current] : []
  const idx = current.indexOf(option)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(option)
  }
  emit('update:value', { name: variable.name, value: current })
}

function isMultiOptionSelected(variable: DashboardVariable, option: string): boolean {
  return Array.isArray(variable.current) && variable.current.includes(option)
}

function multiDisplayValue(variable: DashboardVariable): string {
  if (Array.isArray(variable.current) && variable.current.length > 0) {
    return variable.current.join(', ')
  }
  return 'Select...'
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 px-4 py-2"
    :style="{
      backgroundColor: 'var(--color-surface-container-low)',
      borderBottom: '1px solid var(--color-outline-variant)',
    }"
  >
    <div
      v-for="variable in variables"
      :key="variable.id"
      class="flex items-center gap-1.5"
    >
      <!-- Label -->
      <label
        class="text-xs font-medium"
        :style="{ color: 'var(--color-on-surface-variant)' }"
        :for="`var-${variable.name}`"
      >
        {{ variable.label || variable.name }}
      </label>

      <!-- Warning icon when no options loaded (for query/custom types) -->
      <AlertTriangle
        v-if="variable.type !== 'textbox' && variable.type !== 'constant' && (!variable.options || variable.options.length === 0)"
        :size="14"
        :style="{ color: 'var(--color-tertiary)' }"
        title="No options loaded for this variable"
      />

      <!-- Constant: read-only chip -->
      <span
        v-if="variable.type === 'constant'"
        class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
        :style="{
          backgroundColor: 'var(--color-surface-container-high)',
          color: 'var(--color-on-surface-variant)',
          border: '1px solid var(--color-outline-variant)',
        }"
      >
        {{ variable.current }}
      </span>

      <!-- Textbox: text input -->
      <input
        v-else-if="variable.type === 'textbox'"
        :id="`var-${variable.name}`"
        type="text"
        :value="typeof variable.current === 'string' ? variable.current : ''"
        class="h-7 rounded px-2 text-xs outline-none transition"
        :style="{
          backgroundColor: 'var(--color-surface-container-high)',
          color: 'var(--color-on-surface)',
          border: '1px solid var(--color-outline-variant)',
          minWidth: '100px',
          maxWidth: '180px',
        }"
        @input="handleTextChange(variable, $event)"
      />

      <!-- Multi-select: custom dropdown with checkboxes -->
      <div v-else-if="variable.multi" class="relative">
        <button
          :id="`var-${variable.name}`"
          class="flex h-7 items-center gap-1 rounded px-2 text-xs outline-none transition"
          :style="{
            backgroundColor: 'var(--color-surface-container-high)',
            color: 'var(--color-on-surface)',
            border: '1px solid var(--color-outline-variant)',
            minWidth: '120px',
            maxWidth: '240px',
          }"
          @click="toggleMultiSelect(variable.name)"
        >
          <span class="truncate">{{ multiDisplayValue(variable) }}</span>
        </button>

        <!-- Multi-select popover -->
        <div
          v-if="openMultiSelect === variable.name"
          class="absolute left-0 top-full z-50 mt-1 max-h-48 min-w-[160px] overflow-y-auto rounded-md py-1"
          :style="{
            backgroundColor: 'var(--color-surface-bright)',
            border: '1px solid var(--color-outline-variant)',
            boxShadow: 'var(--shadow-md)',
          }"
        >
          <label
            v-for="option in variable.options"
            :key="option"
            class="flex cursor-pointer items-center gap-2 px-3 py-1 text-xs transition hover:opacity-80"
            :style="{
              color: 'var(--color-on-surface)',
              backgroundColor: isMultiOptionSelected(variable, option)
                ? 'var(--color-primary-muted)'
                : 'transparent',
            }"
          >
            <input
              type="checkbox"
              :checked="isMultiOptionSelected(variable, option)"
              class="accent-[var(--color-primary)]"
              @change="toggleMultiOption(variable, option)"
            />
            {{ option }}
          </label>
          <div
            v-if="variable.options.length === 0"
            class="px-3 py-2 text-xs"
            :style="{ color: 'var(--color-outline)' }"
          >
            No options available
          </div>
        </div>
      </div>

      <!-- Single select -->
      <select
        v-else
        :id="`var-${variable.name}`"
        :value="typeof variable.current === 'string' ? variable.current : ''"
        class="h-7 rounded px-2 text-xs outline-none transition"
        :style="{
          backgroundColor: 'var(--color-surface-container-high)',
          color: 'var(--color-on-surface)',
          border: '1px solid var(--color-outline-variant)',
          minWidth: '120px',
          maxWidth: '200px',
        }"
        @change="handleSingleChange(variable, $event)"
      >
        <option value="" disabled>Select...</option>
        <option v-for="option in variable.options" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </div>
  </div>
</template>

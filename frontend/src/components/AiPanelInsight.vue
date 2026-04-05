<script setup lang="ts">
import { Sparkles, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { useAiSidebar } from '../composables/useAiSidebar'

const props = defineProps<{
  panelTitle: string
  insight: string
  actions?: { label: string; handler?: () => void }[]
}>()

const { open: openSidebar } = useAiSidebar()
const dismissed = ref(false)

function handleDeepDive() {
  openSidebar({
    message: `Tell me more about the anomaly in the "${props.panelTitle}" panel: ${props.insight}`,
    panelTitle: props.panelTitle,
  })
}

function dismiss() {
  dismissed.value = true
}
</script>

<template>
  <div
    v-if="!dismissed"
    data-testid="ai-panel-insight"
    class="flex gap-2 items-start px-3 py-2"
    :style="{
      backgroundColor: 'var(--color-primary-muted)',
      borderTop: '1px solid rgba(201, 150, 15, 0.12)',
    }"
  >
    <Sparkles
      :size="14"
      class="shrink-0 mt-0.5"
      :style="{ color: 'var(--color-primary)' }"
    />
    <div class="flex-1 min-w-0">
      <p
        class="text-xs leading-relaxed m-0"
        :style="{ color: 'var(--color-on-surface-variant)' }"
      >
        {{ insight }}
      </p>
      <div class="flex items-center gap-3 mt-1.5">
        <button
          class="text-xs font-medium border-none bg-transparent cursor-pointer p-0"
          :style="{ color: 'var(--color-primary)' }"
          @click="handleDeepDive"
        >
          Deep dive
        </button>
        <button
          v-for="action in actions"
          :key="action.label"
          class="text-xs font-medium border-none bg-transparent cursor-pointer p-0"
          :style="{ color: 'var(--color-primary)' }"
          @click="action.handler?.()"
        >
          {{ action.label }}
        </button>
        <button
          class="text-xs border-none bg-transparent cursor-pointer p-0 ml-auto"
          :style="{ color: 'var(--color-outline)' }"
          @click="dismiss"
          title="Dismiss"
        >
          <X :size="12" />
        </button>
      </div>
    </div>
  </div>
</template>

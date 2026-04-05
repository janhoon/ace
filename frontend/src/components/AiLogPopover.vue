<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
import { useAiSidebar } from '../composables/useAiSidebar'

const props = defineProps<{
  logLine: string
  logLevel?: string
  timestamp?: string
}>()

const emit = defineEmits<{ close: [] }>()

const { open: openSidebar } = useAiSidebar()

function handleFollowUp() {
  openSidebar({
    message: `Analyze this ${props.logLevel || 'error'} log entry and explain what happened:\n\n${props.logLine}`,
  })
  emit('close')
}
</script>

<template>
  <div
    data-testid="ai-log-popover"
    class="relative rounded-lg overflow-hidden"
    :style="{
      backgroundColor: 'var(--color-surface-bright, #1E2429)',
      border: '1px solid rgba(201, 150, 15, 0.2)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }"
  >
    <!-- Arrow -->
    <div
      class="absolute -top-1.5 left-8"
      :style="{
        width: '10px',
        height: '10px',
        backgroundColor: 'var(--color-surface-bright, #1E2429)',
        borderLeft: '1px solid rgba(201, 150, 15, 0.2)',
        borderTop: '1px solid rgba(201, 150, 15, 0.2)',
        transform: 'rotate(45deg)',
      }"
    />

    <div class="px-3 py-2.5">
      <!-- Header -->
      <div class="flex items-center gap-1.5 mb-2">
        <Sparkles :size="12" :style="{ color: 'var(--color-primary)' }" />
        <span
          :style="{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-primary)',
          }"
        >AI Analysis</span>
      </div>

      <!-- Placeholder content (real analysis would come from AI) -->
      <p
        class="m-0 mb-2.5 leading-relaxed"
        :style="{
          fontSize: '12px',
          color: 'var(--color-on-surface-variant)',
        }"
      >
        Click <strong :style="{ color: 'var(--color-on-surface)', fontWeight: 500 }">Ask Copilot</strong>
        to get AI analysis of this log entry, including root cause investigation, impact assessment, and suggested next steps.
      </p>

      <!-- Actions -->
      <div class="flex gap-2">
        <button
          class="text-xs font-medium rounded px-2.5 py-1 cursor-pointer border-none"
          :style="{
            backgroundColor: 'var(--color-primary)',
            color: '#0B0D0F',
          }"
          @click="handleFollowUp"
        >
          Ask Copilot
        </button>
        <button
          class="text-xs font-medium rounded px-2.5 py-1 cursor-pointer"
          :style="{
            backgroundColor: 'var(--color-surface-container-high)',
            color: 'var(--color-on-surface-variant)',
            border: '1px solid var(--color-stroke-subtle)',
          }"
          @click="emit('close')"
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
import { useAiSidebar } from '../composables/useAiSidebar'

const props = defineProps<{
  alertCount: number
  alertNames?: string[]
}>()

const { open: openSidebar } = useAiSidebar()

function handleInvestigate() {
  const names = props.alertNames?.join(', ') || `${props.alertCount} alerts`
  openSidebar({
    message: `Investigate the currently firing alerts: ${names}. Analyze root causes, correlate with recent deployments or changes, assess severity, and suggest remediation steps.`,
  })
}
</script>

<template>
  <div
    data-testid="ai-alert-triage"
    class="rounded-lg overflow-hidden"
    :style="{
      borderLeft: '2px solid var(--color-primary)',
      backgroundColor: 'var(--color-primary-muted)',
    }"
  >
    <div class="px-3 py-2.5">
      <!-- Header -->
      <div class="flex items-center gap-1.5 mb-1.5">
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
        >AI Triage</span>
      </div>

      <p
        class="text-sm m-0 mb-2"
        :style="{ color: 'var(--color-on-surface-variant)' }"
      >
        {{ alertCount }} alert{{ alertCount !== 1 ? 's' : '' }} firing.
        Open Copilot for root cause analysis, impact assessment, and suggested remediation.
      </p>

      <button
        class="text-xs font-medium rounded px-2.5 py-1 cursor-pointer border-none"
        :style="{
          backgroundColor: 'var(--color-primary)',
          color: '#0B0D0F',
        }"
        @click="handleInvestigate"
      >
        Investigate with Copilot
      </button>
    </div>
  </div>
</template>

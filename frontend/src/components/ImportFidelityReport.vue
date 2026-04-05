<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-vue-next'
import type { ConversionReport } from '../types/converter'

const props = defineProps<{
  report: ConversionReport
}>()

const fidelityColor = computed(() => {
  if (props.report.fidelity_percent >= 80) return 'var(--color-secondary)'
  if (props.report.fidelity_percent >= 50) return 'var(--color-tertiary)'
  return 'var(--color-error)'
})

const fidelityBgColor = computed(() => {
  if (props.report.fidelity_percent >= 80) return 'rgba(79, 175, 120, 0.12)'
  if (props.report.fidelity_percent >= 50) return 'rgba(212, 161, 30, 0.12)'
  return 'rgba(217, 92, 84, 0.12)'
})

function statusIcon(status: string) {
  if (status === 'mapped') return CheckCircle
  if (status === 'partial') return AlertTriangle
  return XCircle
}

function statusColor(status: string) {
  if (status === 'mapped') return 'var(--color-secondary)'
  if (status === 'partial') return 'var(--color-tertiary)'
  return 'var(--color-error)'
}

function statusBgColor(status: string) {
  if (status === 'mapped') return 'rgba(79, 175, 120, 0.12)'
  if (status === 'partial') return 'rgba(212, 161, 30, 0.12)'
  return 'rgba(217, 92, 84, 0.12)'
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Fidelity badge and summary -->
    <div class="flex items-center gap-4">
      <div
        class="flex items-center gap-2 rounded-md px-3 py-1.5"
        :style="{ backgroundColor: fidelityBgColor, color: fidelityColor }"
      >
        <component
          :is="report.fidelity_percent >= 80 ? CheckCircle : report.fidelity_percent >= 50 ? AlertTriangle : XCircle"
          :size="18"
        />
        <span class="font-semibold" style="font-family: var(--font-display)">
          {{ report.fidelity_percent }}% fidelity
        </span>
      </div>
    </div>

    <!-- Summary stats -->
    <div
      class="grid grid-cols-2 gap-3 rounded-lg p-4 sm:grid-cols-5"
      :style="{ backgroundColor: 'var(--color-surface-container-low)', border: '1px solid var(--color-stroke-subtle)' }"
    >
      <div class="flex flex-col gap-1">
        <span
          class="text-xs uppercase tracking-widest"
          :style="{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }"
        >
          Total
        </span>
        <span class="text-lg font-semibold" :style="{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-display)' }">
          {{ report.total_panels }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span
          class="text-xs uppercase tracking-widest"
          :style="{ color: 'var(--color-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }"
        >
          Mapped
        </span>
        <span class="text-lg font-semibold" :style="{ color: 'var(--color-secondary)', fontFamily: 'var(--font-display)' }">
          {{ report.mapped_panels }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span
          class="text-xs uppercase tracking-widest"
          :style="{ color: 'var(--color-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }"
        >
          Partial
        </span>
        <span class="text-lg font-semibold" :style="{ color: 'var(--color-tertiary)', fontFamily: 'var(--font-display)' }">
          {{ report.partial_panels }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span
          class="text-xs uppercase tracking-widest"
          :style="{ color: 'var(--color-error)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }"
        >
          Unsupported
        </span>
        <span class="text-lg font-semibold" :style="{ color: 'var(--color-error)', fontFamily: 'var(--font-display)' }">
          {{ report.unsupported_panels }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span
          class="text-xs uppercase tracking-widest"
          :style="{ color: 'var(--color-info)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }"
        >
          Variables
        </span>
        <span class="text-lg font-semibold" :style="{ color: 'var(--color-info)', fontFamily: 'var(--font-display)' }">
          {{ report.variables_found }}
        </span>
      </div>
    </div>

    <!-- Per-panel diagnostics table -->
    <div
      v-if="report.panel_diagnostics.length > 0"
      class="overflow-hidden rounded-lg"
      :style="{ border: '1px solid var(--color-stroke-subtle)' }"
    >
      <table class="w-full text-sm" :style="{ color: 'var(--color-on-surface)' }">
        <thead>
          <tr :style="{ backgroundColor: 'var(--color-surface-container-low)' }">
            <th
              class="px-4 py-2.5 text-left text-xs uppercase tracking-widest font-medium"
              :style="{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-stroke-subtle)' }"
            >
              Panel
            </th>
            <th
              class="px-4 py-2.5 text-left text-xs uppercase tracking-widest font-medium"
              :style="{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-stroke-subtle)' }"
            >
              Grafana Type
            </th>
            <th
              class="px-4 py-2.5 text-left text-xs uppercase tracking-widest font-medium"
              :style="{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-stroke-subtle)' }"
            >
              Ace Type
            </th>
            <th
              class="px-4 py-2.5 text-left text-xs uppercase tracking-widest font-medium"
              :style="{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-stroke-subtle)' }"
            >
              Status
            </th>
            <th
              class="px-4 py-2.5 text-left text-xs uppercase tracking-widest font-medium"
              :style="{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-stroke-subtle)' }"
            >
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="diag in report.panel_diagnostics"
            :key="diag.index"
            :style="{ borderBottom: '1px solid var(--color-stroke-subtle)' }"
          >
            <td class="px-4 py-2.5 font-medium" :style="{ color: 'var(--color-on-surface)' }">
              {{ diag.title }}
            </td>
            <td class="px-4 py-2.5" :style="{ fontFamily: 'var(--font-mono)', color: 'var(--color-on-surface-variant)' }">
              {{ diag.original_type }}
            </td>
            <td class="px-4 py-2.5" :style="{ fontFamily: 'var(--font-mono)', color: 'var(--color-on-surface-variant)' }">
              {{ diag.mapped_type || '\u2014' }}
            </td>
            <td class="px-4 py-2.5">
              <span
                class="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium"
                :style="{ backgroundColor: statusBgColor(diag.status), color: statusColor(diag.status) }"
              >
                <component :is="statusIcon(diag.status)" :size="13" />
                {{ diag.status }}
              </span>
            </td>
            <td class="px-4 py-2.5 text-xs" :style="{ color: 'var(--color-on-surface-variant)' }">
              <span v-if="diag.warning" class="flex items-center gap-1">
                <Info :size="13" :style="{ color: 'var(--color-tertiary)' }" />
                {{ diag.warning }}
              </span>
              <span v-else-if="diag.field_overrides_dropped" class="flex items-center gap-1">
                <Info :size="13" :style="{ color: 'var(--color-tertiary)' }" />
                {{ diag.field_overrides_dropped }} field override(s) dropped
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

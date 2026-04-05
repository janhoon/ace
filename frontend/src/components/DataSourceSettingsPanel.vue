<template>
  <div class="relative">
    <!-- Loading state -->
    <div v-if="loading" class="flex flex-col gap-3">
      <div v-for="i in 3" :key="i" class="h-14 rounded-sm bg-[var(--color-surface-container-high)] animate-pulse" />
    </div>

    <!-- Empty state -->
    <div v-else-if="datasources.length === 0" class="flex flex-col items-center justify-center px-8 py-12 text-center gap-3">
      <Database :size="40" class="text-[var(--color-outline)]" />
      <h3 class="m-0 text-base text-[var(--color-on-surface)]">No data sources configured</h3>
      <p class="m-0 text-[var(--color-on-surface-variant)] text-sm">Add a data source to start visualising your metrics, logs, and traces.</p>
      <RouterLink :to="`/app/datasources/new?orgId=${orgId}`" data-testid="ds-panel-add-empty-btn" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--color-primary)] text-white border-none rounded-sm text-sm font-medium cursor-pointer no-underline transition hover:bg-[var(--color-primary)]-hover">
        Add data source
      </RouterLink>
    </div>

    <!-- Datasource list -->
    <div v-else>
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm text-[var(--color-on-surface-variant)] font-medium">{{ datasources.length }} data source{{ datasources.length !== 1 ? 's' : '' }}</span>
        <RouterLink :to="`/app/datasources/new?orgId=${orgId}`" data-testid="ds-panel-add-btn" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--color-primary)] text-white border-none rounded-sm text-sm font-medium cursor-pointer no-underline transition hover:bg-[var(--color-primary)]-hover">
          Add data source
        </RouterLink>
      </div>

      <div class="flex flex-col gap-2">
        <div v-for="ds in datasources" :key="ds.id" :data-testid="`ds-panel-row-${ds.id}`" class="flex items-center justify-between gap-4 px-4 py-3 bg-[var(--color-surface-container-high)] rounded transition-colors hover:border-[var(--color-primary)]/20">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <img v-if="dataSourceTypeLogos[ds.type]" :src="dataSourceTypeLogos[ds.type]" :alt="ds.type" class="h-5 w-5 shrink-0 object-contain" />
              <span class="inline-flex px-2 py-0.5 rounded-sm text-[0.68rem] font-semibold uppercase tracking-wide bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 whitespace-nowrap">{{ dataSourceTypeLabels[ds.type] }}</span>
            </div>
            <span class="text-sm font-semibold text-[var(--color-on-surface)] whitespace-nowrap overflow-hidden text-ellipsis">{{ ds.name }}</span>
            <span class="text-xs text-[var(--color-outline)] whitespace-nowrap overflow-hidden text-ellipsis">{{ ds.url }}</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <Transition name="fade">
              <span v-if="testStatus[ds.id] === 'testing'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium text-[var(--color-on-surface-variant)]">
                <Loader2 :size="12" class="animate-spin" /> Testing…
              </span>
              <span v-else-if="testStatus[ds.id] === 'ok'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <CheckCircle2 :size="12" /> Connected
              </span>
              <span v-else-if="testStatus[ds.id] === 'error'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-[var(--color-error)]/10 text-[var(--color-error)]">
                <XCircle :size="12" /> Failed
              </span>
            </Transition>
            <button @click="testDatasource(ds.id)" :data-testid="`ds-panel-test-${ds.id}`" :disabled="testStatus[ds.id] === 'testing'" class="inline-flex items-center justify-center w-[30px] h-[30px] p-0 bg-transparent border border-transparent rounded-sm text-[var(--color-on-surface-variant)] cursor-pointer transition-all no-underline hover:bg-[var(--color-surface-container-high)] hover:-strong hover:text-[var(--color-on-surface)] disabled:opacity-50 disabled:cursor-not-allowed" title="Test connection">
              <Zap :size="14" />
            </button>
            <RouterLink :to="`/app/datasources/${ds.id}/edit`" :data-testid="`ds-panel-edit-${ds.id}`" class="inline-flex items-center justify-center w-[30px] h-[30px] p-0 bg-transparent border border-transparent rounded-sm text-[var(--color-on-surface-variant)] cursor-pointer transition-all no-underline hover:bg-[var(--color-surface-container-high)] hover:-strong hover:text-[var(--color-on-surface)]" title="Edit">
              <Edit2 :size="14" />
            </RouterLink>
            <button @click="deleteDatasource(ds.id)" :data-testid="`ds-panel-delete-${ds.id}`" class="inline-flex items-center justify-center w-[30px] h-[30px] p-0 bg-transparent border border-transparent rounded-sm text-[var(--color-on-surface-variant)] cursor-pointer transition-all no-underline hover:bg-[var(--color-surface-container-high)] hover:-strong hover:text-[var(--color-on-surface)] hover:!bg-[var(--color-error)]/15 hover:!border-[var(--color-error)]/30 hover:!text-[var(--color-error)]" title="Delete">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { CheckCircle2, Database, Edit2, Loader2, Trash2, XCircle, Zap } from 'lucide-vue-next'
import { listDataSources, deleteDataSource, testDataSourceConnection } from '../api/datasources'
import type { DataSource } from '../types/datasource'
import { dataSourceTypeLabels } from '../types/datasource'
import { dataSourceTypeLogos } from '../utils/datasourceLogos'

const props = defineProps<{ orgId: string }>()

const datasources = ref<DataSource[]>([])
const loading = ref(true)
const testStatus = ref<Record<string, 'testing' | 'ok' | 'error'>>({})

async function fetchDatasources() {
  loading.value = true
  try {
    datasources.value = await listDataSources(props.orgId)
  } catch {
    datasources.value = []
  } finally {
    loading.value = false
  }
}

async function deleteDatasource(id: string) {
  if (!confirm('Delete this data source?')) return
  await deleteDataSource(id)
  await fetchDatasources()
}

async function testDatasource(id: string) {
  testStatus.value[id] = 'testing'
  try {
    await testDataSourceConnection(id)
    testStatus.value[id] = 'ok'
  } catch {
    testStatus.value[id] = 'error'
  }
  setTimeout(() => { delete testStatus.value[id] }, 4000)
}

watch(() => props.orgId, fetchDatasources)
onMounted(fetchDatasources)
</script>

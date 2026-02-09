<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Pencil, Trash2, LayoutDashboard, AlertCircle, Folder as FolderIcon, Inbox, Shield } from 'lucide-vue-next'
import type { Dashboard } from '../types/dashboard'
import type { Folder } from '../types/folder'
import { listDashboards, deleteDashboard, updateDashboard } from '../api/dashboards'
import { listFolders, createFolder } from '../api/folders'
import { useOrganization } from '../composables/useOrganization'
import CreateDashboardModal from './CreateDashboardModal.vue'
import EditDashboardModal from './EditDashboardModal.vue'
import FolderPermissionsModal from './FolderPermissionsModal.vue'

const router = useRouter()
const route = useRoute()
const { currentOrgId, currentOrg } = useOrganization()

const dashboards = ref<Dashboard[]>([])
const folders = ref<Folder[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showCreateModal = ref(false)
const createModalInitialMode = ref<'create' | 'import' | 'grafana'>('create')
const showEditModal = ref(false)
const editingDashboard = ref<Dashboard | null>(null)
const showDeleteConfirm = ref(false)
const deletingDashboard = ref<Dashboard | null>(null)
const showFolderPermissionsModal = ref(false)
const selectedFolderForPermissions = ref<Folder | null>(null)
const folderPermissionsMessage = ref<string | null>(null)
const showCreateFolderModal = ref(false)
const creatingFolder = ref(false)
const folderName = ref('')
const folderError = ref<string | null>(null)
const moveError = ref<string | null>(null)
const draggingDashboardId = ref<string | null>(null)
const dropTargetSectionId = ref<string | null>(null)
const movingDashboardId = ref<string | null>(null)

interface DashboardSection {
  id: string | null
  name: string
  dashboards: Dashboard[]
  isUnfiled: boolean
  folder: Folder | null
}

const isOrgAdmin = computed(() => currentOrg.value?.role === 'admin')
const canCreateFolder = computed(() => currentOrg.value?.role === 'admin' || currentOrg.value?.role === 'editor')
const canManageDashboards = computed(() => currentOrg.value?.role === 'admin' || currentOrg.value?.role === 'editor')

const groupedDashboardSections = computed<DashboardSection[]>(() => {
  const folderIds = new Set(folders.value.map((folder) => folder.id))

  const folderSections = folders.value.map((folder) => ({
    id: folder.id,
    name: folder.name,
    dashboards: dashboards.value.filter((dashboard) => dashboard.folder_id === folder.id),
    isUnfiled: false,
    folder,
  }))

  const unfiledDashboards = dashboards.value.filter((dashboard) => !dashboard.folder_id || !folderIds.has(dashboard.folder_id))

  return [
    ...folderSections,
    {
      id: null,
      name: 'Unfiled Dashboards',
      dashboards: unfiledDashboards,
      isUnfiled: true,
      folder: null,
    },
  ]
})

const isCompletelyEmpty = computed(() => dashboards.value.length === 0 && folders.value.length === 0)
const hasNoFolders = computed(() => folders.value.length === 0)

async function fetchDashboards() {
  if (!currentOrgId.value) {
    dashboards.value = []
    folders.value = []
    loading.value = false
    return
  }

  loading.value = true
  error.value = null
  try {
    const [dashboardResponse, folderResponse] = await Promise.all([
      listDashboards(currentOrgId.value),
      listFolders(currentOrgId.value),
    ])
    dashboards.value = dashboardResponse
    folders.value = folderResponse
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load dashboards'
  } finally {
    loading.value = false
  }
}

// Refetch dashboards when organization changes
watch(currentOrgId, () => {
  fetchDashboards()
})

function normalizeCreateMode(rawMode: unknown): 'create' | 'import' | 'grafana' | null {
  if (rawMode === 'create' || rawMode === 'import' || rawMode === 'grafana') {
    return rawMode
  }
  return null
}

function openCreateModalWithMode(initialMode: 'create' | 'import' | 'grafana') {
  createModalInitialMode.value = initialMode
  showCreateModal.value = true
}

function openCreateModal() {
  openCreateModalWithMode('create')
}

function openCreateFolderModal() {
  folderName.value = ''
  folderError.value = null
  showCreateFolderModal.value = true
}

function closeCreateFolderModal() {
  showCreateFolderModal.value = false
  folderName.value = ''
  folderError.value = null
}

function closeCreateModal() {
  showCreateModal.value = false
}

function onDashboardCreated() {
  closeCreateModal()
  fetchDashboards()
}

function openEditModal(dashboard: Dashboard) {
  editingDashboard.value = dashboard
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editingDashboard.value = null
}

function onDashboardUpdated() {
  closeEditModal()
  fetchDashboards()
}

function confirmDelete(dashboard: Dashboard) {
  deletingDashboard.value = dashboard
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deletingDashboard.value = null
}

async function handleDelete() {
  if (!deletingDashboard.value) return

  try {
    await deleteDashboard(deletingDashboard.value.id)
    cancelDelete()
    fetchDashboards()
  } catch (e) {
    error.value = 'Failed to delete dashboard'
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function openDashboard(dashboard: Dashboard) {
  router.push(`/dashboards/${dashboard.id}`)
}

function normalizeSectionId(sectionId: string | null): string {
  return sectionId ?? 'unfiled'
}

function onDashboardDragStart(dashboard: Dashboard) {
  if (!canManageDashboards.value) {
    return
  }

  moveError.value = null
  draggingDashboardId.value = dashboard.id
}

function onDashboardDragEnd() {
  draggingDashboardId.value = null
  dropTargetSectionId.value = null
}

function onSectionDragOver(sectionId: string | null) {
  if (!canManageDashboards.value || !draggingDashboardId.value) {
    return
  }

  dropTargetSectionId.value = normalizeSectionId(sectionId)
}

async function onSectionDrop(sectionId: string | null) {
  if (!canManageDashboards.value || !draggingDashboardId.value || movingDashboardId.value) {
    return
  }

  const dashboardId = draggingDashboardId.value
  const targetFolderId = sectionId
  const dashboard = dashboards.value.find((item) => item.id === dashboardId)

  if (!dashboard) {
    onDashboardDragEnd()
    return
  }

  const currentFolderId = dashboard.folder_id ?? null
  if (currentFolderId === targetFolderId) {
    onDashboardDragEnd()
    return
  }

  moveError.value = null
  movingDashboardId.value = dashboardId
  dashboards.value = dashboards.value.map((item) =>
    item.id === dashboardId
      ? {
          ...item,
          folder_id: targetFolderId,
        }
      : item,
  )

  try {
    await updateDashboard(dashboardId, {
      folder_id: targetFolderId,
    })
  } catch (e) {
    dashboards.value = dashboards.value.map((item) =>
      item.id === dashboardId
        ? {
            ...item,
            folder_id: currentFolderId,
          }
        : item,
    )
    moveError.value = e instanceof Error ? e.message : 'Failed to move dashboard'
  } finally {
    movingDashboardId.value = null
    onDashboardDragEnd()
  }
}

function openFolderPermissions(folder: Folder) {
  selectedFolderForPermissions.value = folder
  folderPermissionsMessage.value = null
  showFolderPermissionsModal.value = true
}

function closeFolderPermissionsModal() {
  showFolderPermissionsModal.value = false
  selectedFolderForPermissions.value = null
}

async function onFolderPermissionsSaved() {
  if (!selectedFolderForPermissions.value) {
    return
  }

  const folderName = selectedFolderForPermissions.value.name

  closeFolderPermissionsModal()
  folderPermissionsMessage.value = `Updated permissions for "${folderName}"`
  await fetchDashboards()
}

async function handleCreateFolder() {
  if (!folderName.value.trim()) {
    folderError.value = 'Folder name is required'
    return
  }

  if (!currentOrgId.value) {
    folderError.value = 'No organization selected'
    return
  }

  creatingFolder.value = true
  folderError.value = null

  try {
    await createFolder(currentOrgId.value, {
      name: folderName.value.trim(),
    })
    closeCreateFolderModal()
    await fetchDashboards()
  } catch (e) {
    folderError.value = e instanceof Error ? e.message : 'Failed to create folder'
  } finally {
    creatingFolder.value = false
  }
}

onMounted(fetchDashboards)

onMounted(() => {
  const modeFromQuery = normalizeCreateMode(route.query.newDashboardMode)
  if (!modeFromQuery) {
    return
  }

  openCreateModalWithMode(modeFromQuery)

  const nextQuery = { ...route.query }
  delete nextQuery.newDashboardMode
  router.replace({ query: nextQuery })
})
</script>

<template>
  <div class="dashboard-list">
    <header class="page-header">
      <div class="header-content">
        <h1>Dashboards</h1>
        <p class="header-subtitle">Monitor your metrics and visualize data</p>
      </div>
      <div class="header-actions">
        <button v-if="canCreateFolder" class="btn btn-secondary" data-testid="new-folder-header" @click="openCreateFolderModal">
          <FolderIcon :size="18" />
          <span>New Folder</span>
        </button>
        <button class="btn btn-primary" @click="openCreateModal">
        <Plus :size="18" />
        <span>New Dashboard</span>
        </button>
      </div>
    </header>

    <div v-if="loading" class="state-container">
      <div class="loading-spinner"></div>
      <p>Loading dashboards...</p>
    </div>

    <div v-else-if="error" class="state-container error">
      <AlertCircle :size="48" />
      <p>{{ error }}</p>
      <button class="btn btn-secondary" @click="fetchDashboards">Try Again</button>
    </div>

    <div v-else-if="isCompletelyEmpty" class="state-container empty">
      <div class="empty-icon">
        <LayoutDashboard :size="64" />
      </div>
      <h2>No dashboards yet</h2>
      <p>Create your first dashboard to start monitoring your metrics</p>
      <div class="empty-actions">
        <button v-if="canCreateFolder" class="btn btn-secondary" data-testid="new-folder-empty" @click="openCreateFolderModal">
          <FolderIcon :size="18" />
          <span>Create Folder</span>
        </button>
        <button class="btn btn-primary" @click="openCreateModal">
          <Plus :size="18" />
          <span>Create Dashboard</span>
        </button>
      </div>
    </div>

    <div v-else class="folder-sections">
      <p v-if="folderPermissionsMessage" class="success-message">{{ folderPermissionsMessage }}</p>
      <p v-if="moveError" class="section-error">{{ moveError }}</p>
      <div v-if="hasNoFolders" class="folder-cta" data-testid="folder-empty-cta">
        <div>
          <h2>No folders yet</h2>
          <p>Use folders to organize dashboards by team, service, or environment.</p>
        </div>
        <button v-if="canCreateFolder" class="btn btn-secondary" data-testid="new-folder-cta" @click="openCreateFolderModal">
          <FolderIcon :size="16" />
          <span>New Folder</span>
        </button>
      </div>

      <section
        v-for="section in groupedDashboardSections"
        :key="section.id ?? 'unfiled'"
        class="folder-section"
        :class="{
          'folder-section-drop-active': dropTargetSectionId === normalizeSectionId(section.id),
        }"
        :data-testid="`folder-section-${section.id ?? 'unfiled'}`"
        @dragover.prevent="onSectionDragOver(section.id)"
        @drop.prevent="onSectionDrop(section.id)"
      >
        <div class="folder-section-header">
          <div class="folder-section-title">
            <component :is="section.isUnfiled ? Inbox : FolderIcon" :size="18" />
            <h2>{{ section.name }}</h2>
          </div>
          <div class="folder-section-meta">
            <span class="folder-count">{{ section.dashboards.length }}</span>
            <button
              v-if="isOrgAdmin && !section.isUnfiled && section.folder"
              class="btn btn-secondary btn-sm"
              :data-testid="`folder-permissions-${section.folder.id}`"
              @click="openFolderPermissions(section.folder)"
            >
              <Shield :size="14" />
              Permissions
            </button>
          </div>
        </div>
        <p v-if="section.isUnfiled" class="folder-description">
          Dashboards without an assigned folder
        </p>

        <p v-if="section.dashboards.length === 0" class="section-empty">
          No dashboards in this section yet.
        </p>

        <div v-else class="dashboard-grid">
          <div
            v-for="dashboard in section.dashboards"
            :key="dashboard.id"
            class="dashboard-card"
            :class="{
              'dashboard-card-dragging': draggingDashboardId === dashboard.id,
              'dashboard-card-draggable': canManageDashboards,
            }"
            :data-testid="`dashboard-card-${dashboard.id}`"
            :draggable="canManageDashboards"
            @dragstart="onDashboardDragStart(dashboard)"
            @dragend="onDashboardDragEnd"
            @click="openDashboard(dashboard)"
          >
            <div class="card-header">
              <h3>{{ dashboard.title }}</h3>
              <div class="card-actions" @click.stop>
                <button class="btn-icon" @click="openEditModal(dashboard)" title="Edit">
                  <Pencil :size="16" />
                </button>
                <button class="btn-icon btn-icon-danger" @click="confirmDelete(dashboard)" title="Delete">
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
            <p v-if="dashboard.description" class="card-description">
              {{ dashboard.description }}
            </p>
            <div class="card-meta">
              <span>Created {{ formatDate(dashboard.created_at) }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <CreateDashboardModal
      v-if="showCreateModal"
      :initial-mode="createModalInitialMode"
      @close="closeCreateModal"
      @created="onDashboardCreated"
    />

    <EditDashboardModal
      v-if="showEditModal && editingDashboard"
      :dashboard="editingDashboard"
      :folders="folders"
      @close="closeEditModal"
      @updated="onDashboardUpdated"
    />

    <FolderPermissionsModal
      v-if="showFolderPermissionsModal && selectedFolderForPermissions && currentOrgId"
      :folder="selectedFolderForPermissions"
      :org-id="currentOrgId"
      @close="closeFolderPermissionsModal"
      @saved="onFolderPermissionsSaved"
    />

    <div v-if="showCreateFolderModal" class="modal-overlay" @click.self="closeCreateFolderModal">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Create folder dialog">
        <h2>Create Folder</h2>
        <p class="modal-description">Organize dashboards into shared sections.</p>
        <form @submit.prevent="handleCreateFolder">
          <div class="form-group">
            <label for="folder-name">Folder Name</label>
            <input
              id="folder-name"
              v-model="folderName"
              type="text"
              placeholder="Operations"
              :disabled="creatingFolder"
              autocomplete="off"
            />
          </div>

          <p v-if="folderError" class="error-message">{{ folderError }}</p>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" :disabled="creatingFolder" @click="closeCreateFolderModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="creatingFolder">
              {{ creatingFolder ? 'Creating...' : 'Create Folder' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="cancelDelete">
      <div class="modal delete-modal">
        <div class="modal-icon">
          <Trash2 :size="24" />
        </div>
        <h2>Delete Dashboard</h2>
        <p>Are you sure you want to delete "{{ deletingDashboard?.title }}"?</p>
        <p class="warning">This action cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="cancelDelete">Cancel</button>
          <button class="btn btn-danger" @click="handleDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-list {
  padding: 2rem 2.25rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  background: var(--surface-1);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.header-content h1 {
  margin-bottom: 0.35rem;
  font-family: var(--font-mono);
  font-size: 1.12rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.header-subtitle {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.62rem 1.05rem;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  border-color: rgba(125, 211, 252, 0.4);
  color: white;
  box-shadow: 0 8px 24px rgba(14, 165, 233, 0.24);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(14, 165, 233, 0.28);
}

.btn-secondary {
  background: var(--surface-2);
  border-color: var(--border-primary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-secondary);
}

.btn-sm {
  padding: 0.38rem 0.72rem;
  font-size: 0.75rem;
}

.btn-danger {
  background: var(--accent-danger);
  color: white;
}

.btn-danger:hover {
  background: var(--accent-danger-hover);
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-icon-danger:hover {
  background: rgba(255, 107, 107, 0.15);
  color: var(--accent-danger);
}

/* State Containers */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-secondary);
  background: var(--surface-1);
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  min-height: 320px;
}

.state-container.error {
  color: var(--accent-danger);
}

.state-container h2 {
  margin: 1rem 0 0.5rem;
  color: var(--text-primary);
}

.state-container p {
  margin-bottom: 1.5rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(50, 81, 115, 0.65);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  background: linear-gradient(160deg, rgba(56, 189, 248, 0.14), rgba(52, 211, 153, 0.08));
  border: 1px solid var(--border-primary);
  border-radius: 20px;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}

.empty-actions {
  display: flex;
  gap: 0.75rem;
}

.folder-sections {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.folder-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px dashed var(--border-secondary);
  border-radius: 12px;
  padding: 0.95rem 1rem;
  background: var(--surface-2);
}

.folder-cta h2 {
  margin: 0;
  font-size: 0.94rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.folder-cta p {
  margin: 0.3rem 0 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.folder-section {
  background: var(--surface-1);
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  padding: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.folder-section-drop-active {
  border-color: rgba(56, 189, 248, 0.8);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.3);
}

.folder-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.folder-section-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.folder-section-title {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--text-primary);
}

.folder-section-title h2 {
  font-size: 0.95rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  font-family: var(--font-mono);
}

.folder-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.8rem;
  height: 1.8rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-family: var(--font-mono);
}

.folder-description {
  margin-bottom: 0.9rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.section-empty {
  margin-top: 0.8rem;
  color: var(--text-tertiary);
  font-size: 0.84rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 1.5rem;
}

.dashboard-card {
  background: linear-gradient(180deg, rgba(16, 27, 42, 0.92), rgba(14, 24, 38, 0.9));
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.22s ease;
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.dashboard-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
  opacity: 0.5;
}

.dashboard-card:hover {
  border-color: rgba(56, 189, 248, 0.5);
  box-shadow: var(--shadow-md);
  transform: translateY(-4px);
}

.dashboard-card-draggable {
  cursor: grab;
}

.dashboard-card-dragging {
  opacity: 0.5;
  transform: scale(0.99);
}

.dashboard-card-draggable:active {
  cursor: grabbing;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.card-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  max-width: 70%;
  line-height: 1.4;
}

.card-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.dashboard-card:hover .card-actions {
  opacity: 1;
}

.card-description {
  color: var(--text-secondary);
  font-size: 0.84rem;
  margin-bottom: 1rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  font-size: 0.72rem;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(3, 10, 18, 0.76);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: var(--surface-1);
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  animation: slideUp 0.3s ease-out;
}

.modal-description {
  color: var(--text-secondary);
  margin: 0.5rem 0 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.form-group label {
  color: var(--text-primary);
  font-size: 0.84rem;
}

.form-group input {
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-primary);
  background: var(--surface-2);
  color: var(--text-primary);
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: var(--focus-ring);
}

.error-message {
  margin: 0;
  color: var(--accent-danger);
  font-size: 0.82rem;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.delete-modal {
  text-align: center;
}

.modal-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(251, 113, 133, 0.15);
  border-radius: 50%;
  color: var(--accent-danger);
  margin-bottom: 1rem;
}

.delete-modal h2 {
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.delete-modal p {
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.warning {
  color: var(--accent-danger);
  font-size: 0.875rem;
}

.success-message {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid rgba(78, 205, 196, 0.3);
  background: rgba(78, 205, 196, 0.1);
  color: var(--accent-success);
  font-size: 0.82rem;
}

.section-error {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid rgba(251, 113, 133, 0.35);
  background: rgba(251, 113, 133, 0.12);
  color: var(--accent-danger);
  font-size: 0.82rem;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

@media (max-width: 900px) {
  .dashboard-list {
    padding: 1.1rem;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    flex: 1;
    justify-content: center;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .folder-section-meta {
    flex-direction: column;
    align-items: flex-end;
  }

  .folder-cta {
    flex-direction: column;
    align-items: stretch;
  }

  .empty-actions {
    flex-direction: column;
    width: 100%;
  }
}
</style>

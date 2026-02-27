<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutDashboard, Settings, Activity, Compass, LogOut, ChevronDown, Shield, Moon, Sun, Monitor, Bell } from 'lucide-vue-next'
import OrganizationDropdown from './OrganizationDropdown.vue'
import CreateOrganizationModal from './CreateOrganizationModal.vue'
import { useOrganization } from '../composables/useOrganization'
import { useAuth } from '../composables/useAuth'
import { useTheme } from '../composables/useTheme'

const route = useRoute()
const router = useRouter()
const { fetchOrganizations, clearOrganizations, currentOrg } = useOrganization()
const { logout, user } = useAuth()
const { mode, cycle } = useTheme()

const isExpanded = ref(false)
const showCreateOrgModal = ref(false)

// Hover flyout logic with delay
let collapseTimeout: ReturnType<typeof setTimeout> | null = null
const isHovered = ref(false)

function handleMouseEnter() {
  if (collapseTimeout) {
    clearTimeout(collapseTimeout)
    collapseTimeout = null
  }
  isHovered.value = true
}

function handleMouseLeave() {
  collapseTimeout = setTimeout(() => {
    isHovered.value = false
  }, 200)
}

onUnmounted(() => {
  if (collapseTimeout) clearTimeout(collapseTimeout)
})

interface NavItem {
  id: string
  icon: typeof LayoutDashboard
  label: string
  path: string
  children?: NavChild[]
}

interface NavChild {
  label: string
  path: string
}

const navItems: NavItem[] = [
  { id: 'dashboards', icon: LayoutDashboard, label: 'Dashboards', path: '/app/dashboards' },
  { id: 'alerts', icon: Bell, label: 'Alerts', path: '/app/alerts' },
  {
    id: 'explore',
    icon: Compass,
    label: 'Explore',
    path: '/app/explore/metrics',
    children: [
      { label: 'Metrics', path: '/app/explore/metrics' },
      { label: 'Logs', path: '/app/explore/logs' },
      { label: 'Traces', path: '/app/explore/traces' },
    ],
  },
]

function normalizeAppPath(path: string): string {
  if (path.startsWith('/app/')) {
    return path.slice(4)
  }
  return path
}

const openNavGroups = ref<Record<string, boolean>>({
  explore: normalizeAppPath(route.path).startsWith('/explore'),
})

// Settings path is dynamic based on current organization
const settingsPath = computed(() => {
  if (currentOrg.value) {
    return `/app/settings/org/${currentOrg.value.id}/general`
  }
  return null
})

const privacySettingsPath = '/app/settings/privacy'

watch(() => route.path, (path) => {
  if (normalizeAppPath(path).startsWith('/explore')) {
    openNavGroups.value.explore = true
  }
})

function isRouteMatch(path: string): boolean {
  const currentPath = normalizeAppPath(route.path)
  const targetPath = normalizeAppPath(path)
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

function isActive(item: NavItem): boolean {
  if (item.children) {
    return item.children.some(child => isRouteMatch(child.path))
  }
  return isRouteMatch(item.path)
}

function isNavGroupOpen(id: string): boolean {
  return !!openNavGroups.value[id]
}

function toggleNavGroup(id: string) {
  openNavGroups.value[id] = !openNavGroups.value[id]
}

function navigate(path: string) {
  router.push(path)
}

function handleNavItemClick(item: NavItem) {
  if (item.children) {
    openNavGroups.value[item.id] = true
  }
  navigate(item.path)
}

function handleOrgCreated() {
  showCreateOrgModal.value = false
  fetchOrganizations()
}

async function handleLogout() {
  await logout()
  clearOrganizations()
  router.push('/login')
}

defineExpose({ isExpanded })
</script>

<template>
  <aside
    class="fixed left-0 top-0 bottom-0 z-50 flex"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Icon Rail — always visible, 48px -->
    <div class="relative z-10 flex w-12 shrink-0 flex-col bg-[--color-surface-sidebar] border-r border-[#1f1f2e]">
      <!-- Logo -->
      <div class="flex h-12 items-center justify-center shrink-0">
        <img
          v-if="currentOrg?.branding?.logo_data_uri"
          :src="currentOrg.branding.logo_data_uri"
          class="w-5 h-5 rounded object-contain"
          alt="Logo"
        />
        <Activity
          v-else
          class="text-accent"
          :size="20"
        />
      </div>

      <!-- Main nav icons -->
      <nav class="flex flex-1 flex-col items-center gap-1 py-2">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="group relative flex h-9 w-9 items-center justify-center rounded-sm transition-colors duration-150 cursor-pointer border-none"
          :class="[
            isActive(item)
              ? 'bg-accent-muted text-accent before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-accent'
              : 'text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#1a1a24]'
          ]"
          @click="handleNavItemClick(item)"
        >
          <component :is="item.icon" :size="20" />
          <!-- Tooltip (only when flyout is closed) -->
          <span
            v-if="!isHovered"
            class="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2 py-1 bg-[#1a1a24] border border-[#1f1f2e] rounded text-xs font-medium text-[#d1d5db] whitespace-nowrap opacity-0 invisible pointer-events-none z-[100] transition-opacity duration-100 group-hover:opacity-100 group-hover:visible shadow-lg"
          >{{ item.label }}</span>
        </button>

        <!-- Separator -->
        <div class="my-2 w-5 border-t border-[#1f1f2e]"></div>

        <!-- Bottom icons -->
        <div class="mt-auto flex flex-col items-center gap-1">
          <button
            v-if="settingsPath"
            class="group relative flex h-9 w-9 items-center justify-center rounded-sm transition-colors duration-150 cursor-pointer border-none"
            :class="[
              isRouteMatch('/settings')
                ? 'bg-accent-muted text-accent before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-accent'
                : 'text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#1a1a24]'
            ]"
            @click="navigate(settingsPath)"
          >
            <Settings :size="20" />
            <span
              v-if="!isHovered"
              class="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2 py-1 bg-[#1a1a24] border border-[#1f1f2e] rounded text-xs font-medium text-[#d1d5db] whitespace-nowrap opacity-0 invisible pointer-events-none z-[100] transition-opacity duration-100 group-hover:opacity-100 group-hover:visible shadow-lg"
            >Settings</span>
          </button>

          <button
            class="group relative flex h-9 w-9 items-center justify-center rounded-sm transition-colors duration-150 cursor-pointer border-none"
            :class="[
              isRouteMatch(privacySettingsPath)
                ? 'bg-accent-muted text-accent before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-accent'
                : 'text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#1a1a24]'
            ]"
            @click="navigate(privacySettingsPath)"
          >
            <Shield :size="20" />
            <span
              v-if="!isHovered"
              class="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2 py-1 bg-[#1a1a24] border border-[#1f1f2e] rounded text-xs font-medium text-[#d1d5db] whitespace-nowrap opacity-0 invisible pointer-events-none z-[100] transition-opacity duration-100 group-hover:opacity-100 group-hover:visible shadow-lg"
            >Privacy</span>
          </button>

          <button
            class="group relative flex h-9 w-9 items-center justify-center rounded-sm text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#1a1a24] transition-colors duration-150 cursor-pointer border-none"
            @click="cycle()"
            :title="`Theme: ${mode}`"
          >
            <Moon v-if="mode === 'dark'" :size="20" />
            <Sun v-if="mode === 'light'" :size="20" />
            <Monitor v-if="mode === 'system'" :size="20" />
            <span
              v-if="!isHovered"
              class="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2 py-1 bg-[#1a1a24] border border-[#1f1f2e] rounded text-xs font-medium text-[#d1d5db] whitespace-nowrap opacity-0 invisible pointer-events-none z-[100] transition-opacity duration-100 group-hover:opacity-100 group-hover:visible shadow-lg"
            >Theme: {{ mode }}</span>
          </button>

          <button
            class="group relative flex h-9 w-9 items-center justify-center rounded-sm text-[#6b7280] hover:text-rose-500 hover:bg-rose-500/10 transition-colors duration-150 cursor-pointer border-none mb-2"
            @click="handleLogout"
          >
            <LogOut :size="20" />
            <span
              v-if="!isHovered"
              class="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2 py-1 bg-[#1a1a24] border border-[#1f1f2e] rounded text-xs font-medium text-[#d1d5db] whitespace-nowrap opacity-0 invisible pointer-events-none z-[100] transition-opacity duration-100 group-hover:opacity-100 group-hover:visible shadow-lg"
            >Log out</span>
          </button>
        </div>
      </nav>
    </div>

    <!-- Flyout Panel — appears on hover -->
    <div
      class="flex flex-col overflow-hidden bg-[--color-surface-sidebar] border-r border-[#1f1f2e] shadow-[4px_0_24px_rgba(0,0,0,0.3)] transition-[width,opacity] duration-150 ease-out"
      :class="isHovered ? 'w-[172px] opacity-100' : 'w-0 opacity-0'"
    >
      <div class="flex w-[172px] flex-col h-full">
        <!-- Logo text area -->
        <div class="flex h-12 items-center px-3 shrink-0">
          <span class="text-sm font-bold tracking-wide uppercase font-mono text-[#d1d5db]">{{ currentOrg?.branding?.app_title || 'Ace' }}</span>
        </div>

        <!-- Organization Dropdown -->
        <OrganizationDropdown :expanded="true" @createOrg="showCreateOrgModal = true" />

        <!-- Navigation labels -->
        <nav class="flex flex-1 flex-col py-2 overflow-y-auto">
          <div class="flex flex-col gap-0.5">
            <div
              v-for="item in navItems"
              :key="item.id"
              class="flex flex-col"
            >
              <button
                class="flex h-9 items-center gap-3 px-3 rounded-sm transition-colors duration-150 cursor-pointer border-none mx-1"
                :class="[
                  isActive(item)
                    ? 'text-accent'
                    : 'text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#1a1a24]'
                ]"
                @click="handleNavItemClick(item)"
              >
                <component :is="item.icon" :size="20" class="shrink-0" />
                <span class="text-[0.8125rem] font-medium whitespace-nowrap">{{ item.label }}</span>
                <span
                  v-if="item.children"
                  class="ml-auto inline-flex items-center justify-center w-5 h-5 text-[#6b7280] rounded hover:text-[#d1d5db]"
                  @click.stop="toggleNavGroup(item.id)"
                >
                  <ChevronDown
                    :size="14"
                    :class="['transition-transform duration-200', isNavGroupOpen(item.id) ? 'rotate-180' : '']"
                  />
                </span>
              </button>

              <!-- Submenu children -->
              <div
                v-if="item.children && isNavGroupOpen(item.id)"
                class="flex flex-col gap-px mt-0.5 mb-1 ml-9 mr-1"
              >
                <button
                  v-for="child in item.children"
                  :key="child.path"
                  class="flex h-7 items-center px-2.5 rounded-sm cursor-pointer transition-colors duration-150 border-none"
                  :class="[
                    isRouteMatch(child.path)
                      ? 'text-accent font-medium'
                      : 'text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#1a1a24]'
                  ]"
                  @click="navigate(child.path)"
                >
                  <span class="text-xs">{{ child.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Separator -->
          <div class="mx-3 my-2 border-t border-[#1f1f2e]"></div>

          <!-- Bottom section -->
          <div class="mt-auto flex flex-col gap-0.5">
            <button
              v-if="settingsPath"
              class="flex h-9 items-center gap-3 px-3 rounded-sm transition-colors duration-150 cursor-pointer border-none mx-1"
              :class="[
                isRouteMatch('/settings')
                  ? 'text-accent'
                  : 'text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#1a1a24]'
              ]"
              @click="navigate(settingsPath)"
            >
              <Settings :size="20" class="shrink-0" />
              <span class="text-[0.8125rem] font-medium whitespace-nowrap">Settings</span>
            </button>

            <button
              class="flex h-9 items-center gap-3 px-3 rounded-sm transition-colors duration-150 cursor-pointer border-none mx-1"
              :class="[
                isRouteMatch(privacySettingsPath)
                  ? 'text-accent'
                  : 'text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#1a1a24]'
              ]"
              @click="navigate(privacySettingsPath)"
            >
              <Shield :size="20" class="shrink-0" />
              <span class="text-[0.8125rem] font-medium whitespace-nowrap">Privacy</span>
            </button>

            <button
              class="flex h-9 items-center gap-3 px-3 rounded-sm text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#1a1a24] transition-colors duration-150 cursor-pointer border-none mx-1"
              @click="cycle()"
            >
              <Moon v-if="mode === 'dark'" :size="20" class="shrink-0" />
              <Sun v-if="mode === 'light'" :size="20" class="shrink-0" />
              <Monitor v-if="mode === 'system'" :size="20" class="shrink-0" />
              <span class="text-[0.8125rem] font-medium whitespace-nowrap capitalize">{{ mode }}</span>
            </button>
          </div>
        </nav>

        <!-- User section in flyout -->
        <div class="shrink-0 border-t border-[#1f1f2e] px-3 py-2">
          <span v-if="user" class="block text-[0.6875rem] font-mono text-[#6b7280] truncate mb-1">{{ user.email }}</span>
          <button
            class="flex h-8 w-full items-center gap-2.5 rounded-sm text-[#6b7280] hover:text-rose-500 hover:bg-rose-500/10 transition-colors duration-150 cursor-pointer border-none px-1"
            @click="handleLogout"
          >
            <LogOut :size="18" class="shrink-0" />
            <span class="text-[0.8125rem] font-medium">Log out</span>
          </button>
        </div>
      </div>
    </div>

    <CreateOrganizationModal
      v-if="showCreateOrgModal"
      @close="showCreateOrgModal = false"
      @created="handleOrgCreated"
    />
  </aside>
</template>

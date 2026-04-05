import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const PINNED_KEY = 'ace-sidebar-pinned'

function readPinned(): boolean {
  try {
    return localStorage.getItem(PINNED_KEY) === 'true'
  } catch {
    return false
  }
}

const expandedSection = ref<string | null>(null)
const isPinned = ref(readPinned())

function toggleSection(sectionId: string) {
  if (isPinned.value) {
    // When pinned, just switch which section's sub-nav is shown
    expandedSection.value = sectionId === 'home' ? null : sectionId
    return
  }
  if (expandedSection.value === sectionId) {
    expandedSection.value = null
  } else {
    expandedSection.value = sectionId
  }
}

function closeSection() {
  if (isPinned.value) return // Can't close when pinned
  expandedSection.value = null
}

function togglePin() {
  isPinned.value = !isPinned.value
  localStorage.setItem(PINNED_KEY, String(isPinned.value))
  if (isPinned.value && !expandedSection.value) {
    // When pinning, expand the current route section
    if (cachedRoutePath) {
      const section = routeToSection(cachedRoutePath.value)
      if (section !== 'home') expandedSection.value = section
    }
  }
  if (!isPinned.value) {
    expandedSection.value = null
  }
}

const ROUTE_SECTION_MAP: [string, string][] = [
  ['/app/dashboards', 'dashboards'],
  ['/app/services', 'services'],
  ['/app/alerts', 'alerts'],
  ['/app/explore', 'explore'],
  ['/app/settings', 'settings'],
  ['/app/audit-log', 'settings'],
]

const SHORTCUT_NAV: Record<string, { section: string; route: string }> = {
  '1': { section: 'home', route: '/app' },
  '2': { section: 'dashboards', route: '/app/dashboards' },
  '3': { section: 'services', route: '/app/services' },
  '4': { section: 'alerts', route: '/app/alerts' },
  '5': { section: 'explore', route: '/app/explore/metrics' },
}

function routeToSection(path: string): string {
  for (const [prefix, section] of ROUTE_SECTION_MAP) {
    if (path.startsWith(prefix)) return section
  }
  if (path === '/app' || path === '/app/') return 'home'
  return 'home'
}

let cachedRoutePath: { value: string } | null = null
let router: { push: (path: string) => void } | null = null

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isPinned.value) {
      togglePin() // Unpin + collapse
    } else {
      closeSection()
    }
    return
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
    e.preventDefault()
    togglePin()
    return
  }

  if ((e.metaKey || e.ctrlKey) && SHORTCUT_NAV[e.key]) {
    e.preventDefault()
    const { section, route: targetRoute } = SHORTCUT_NAV[e.key]
    router?.push(targetRoute)

    if (section !== 'home') {
      expandedSection.value = section
    }
  }
}

let listenerRegistered = false

function _reset() {
  expandedSection.value = null
  isPinned.value = false
  cachedRoutePath = null
  router = null
  try { localStorage.removeItem(PINNED_KEY) } catch { /* noop */ }
}

export function useSidebar() {
  const route = useRoute()
  const routerInstance = useRouter()

  if (!cachedRoutePath) {
    cachedRoutePath = { get value() { return route.path } }
    router = routerInstance
  }

  if (!listenerRegistered) {
    window.addEventListener('keydown', handleKeydown)
    listenerRegistered = true
  }

  const currentRouteSection = computed(() => routeToSection(route.path))

  // When pinned, auto-switch expanded section to match route navigation
  watch(currentRouteSection, (section) => {
    if (isPinned.value && section !== 'home') {
      expandedSection.value = section
    }
  })

  // On init, if pinned, expand current route section
  if (isPinned.value) {
    const section = routeToSection(route.path)
    if (section !== 'home') expandedSection.value = section
  }

  return {
    expandedSection,
    isPinned,
    currentRouteSection,
    toggleSection,
    closeSection,
    togglePin,
    _reset,
  }
}

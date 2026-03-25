import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRoutePath = { value: '/app' }
const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: mockRoutePath.value }),
  useRouter: () => ({ push: mockRouterPush }),
}))

import { useSidebar } from './useSidebar'

describe('useSidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    const { _reset } = useSidebar()
    _reset()
    mockRoutePath.value = '/app'
    mockRouterPush.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isExpanded', () => {
    it('defaults to true when localStorage has no value', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
      const { _reset } = useSidebar()
      _reset()
      const { isExpanded } = useSidebar()
      expect(isExpanded.value).toBe(true)
    })

    it('reads persisted state on init (localStorage "false" -> starts collapsed)', () => {
      localStorage.setItem('ace-sidebar-expanded', 'false')
      const { _reset } = useSidebar()
      _reset()
      const { isExpanded } = useSidebar()
      expect(isExpanded.value).toBe(false)
    })

    it('defaults to true when localStorage throws on read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      const { _reset } = useSidebar()
      _reset()
      const { isExpanded } = useSidebar()
      expect(isExpanded.value).toBe(true)
    })

    it('defaults to true when localStorage has non-boolean string', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('banana')
      const { _reset } = useSidebar()
      _reset()
      const { isExpanded } = useSidebar()
      expect(isExpanded.value).toBe(true)
    })
  })

  describe('toggleSidebar', () => {
    it('flips isExpanded and persists to localStorage', () => {
      const { isExpanded, toggleSidebar } = useSidebar()
      expect(isExpanded.value).toBe(true)

      toggleSidebar()
      expect(isExpanded.value).toBe(false)
      expect(localStorage.getItem('ace-sidebar-expanded')).toBe('false')

      toggleSidebar()
      expect(isExpanded.value).toBe(true)
      expect(localStorage.getItem('ace-sidebar-expanded')).toBe('true')
    })
  })

  describe('sidebarWidth', () => {
    it('returns "220px" when expanded', () => {
      const { sidebarWidth, isExpanded } = useSidebar()
      expect(isExpanded.value).toBe(true)
      expect(sidebarWidth.value).toBe('220px')
    })

    it('returns "64px" when collapsed', () => {
      const { sidebarWidth, toggleSidebar } = useSidebar()
      toggleSidebar()
      expect(sidebarWidth.value).toBe('64px')
    })
  })

  describe('toggleSection', () => {
    it('adds a section when not present', () => {
      const { expandedSections, toggleSection } = useSidebar()
      toggleSection('dashboards')
      expect(expandedSections.value.has('dashboards')).toBe(true)
    })

    it('removes a section when already present', () => {
      const { expandedSections, toggleSection } = useSidebar()
      toggleSection('dashboards')
      expect(expandedSections.value.has('dashboards')).toBe(true)
      toggleSection('dashboards')
      expect(expandedSections.value.has('dashboards')).toBe(false)
    })

    it('supports multiple sections open simultaneously', () => {
      const { expandedSections, toggleSection } = useSidebar()
      toggleSection('dashboards')
      toggleSection('explore')
      toggleSection('alerts')
      expect(expandedSections.value.has('dashboards')).toBe(true)
      expect(expandedSections.value.has('explore')).toBe(true)
      expect(expandedSections.value.has('alerts')).toBe(true)
    })
  })

  describe('expandSection', () => {
    it('adds a section to expandedSections', () => {
      const { expandedSections, expandSection } = useSidebar()
      expandSection('dashboards')
      expect(expandedSections.value.has('dashboards')).toBe(true)
    })

    it('is idempotent — adding already-open section is a no-op', () => {
      const { expandedSections, expandSection } = useSidebar()
      expandSection('dashboards')
      expect(expandedSections.value.size).toBe(1)
      expandSection('dashboards')
      expect(expandedSections.value.size).toBe(1)
      expect(expandedSections.value.has('dashboards')).toBe(true)
    })
  })

  describe('currentRouteSection', () => {
    it('maps /app to home', () => {
      mockRoutePath.value = '/app'
      const { currentRouteSection } = useSidebar()
      expect(currentRouteSection.value).toBe('home')
    })

    it('maps /app/explore/metrics to explore', () => {
      mockRoutePath.value = '/app/explore/metrics'
      const { currentRouteSection } = useSidebar()
      expect(currentRouteSection.value).toBe('explore')
    })

    it('maps /app/settings/org/123/general to settings', () => {
      mockRoutePath.value = '/app/settings/org/123/general'
      const { currentRouteSection } = useSidebar()
      expect(currentRouteSection.value).toBe('settings')
    })

    it('maps /app/audit-log to settings', () => {
      mockRoutePath.value = '/app/audit-log'
      const { currentRouteSection } = useSidebar()
      expect(currentRouteSection.value).toBe('settings')
    })
  })

  describe('keyboard shortcuts', () => {
    it('Cmd+B calls toggleSidebar', () => {
      const { isExpanded } = useSidebar()
      expect(isExpanded.value).toBe(true)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true }))
      expect(isExpanded.value).toBe(false)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true }))
      expect(isExpanded.value).toBe(true)
    })

    it('Ctrl+B calls toggleSidebar (Windows/Linux)', () => {
      const { isExpanded } = useSidebar()
      expect(isExpanded.value).toBe(true)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true }))
      expect(isExpanded.value).toBe(false)
    })

    it('Cmd+1 navigates to home WITHOUT expanding', () => {
      const { expandedSections } = useSidebar()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', metaKey: true, bubbles: true }))
      expect(mockRouterPush).toHaveBeenCalledWith('/app')
      expect(expandedSections.value.has('home')).toBe(false)
    })

    it('Cmd+2 navigates to dashboards and expands section', () => {
      const { expandedSections } = useSidebar()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', metaKey: true, bubbles: true }))
      expect(mockRouterPush).toHaveBeenCalledWith('/app/dashboards')
      expect(expandedSections.value.has('dashboards')).toBe(true)
    })

    it('Cmd+3 navigates to services and expands section', () => {
      const { expandedSections } = useSidebar()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', metaKey: true, bubbles: true }))
      expect(mockRouterPush).toHaveBeenCalledWith('/app/services')
      expect(expandedSections.value.has('services')).toBe(true)
    })

    it('Cmd+4 navigates to alerts and expands section', () => {
      const { expandedSections } = useSidebar()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', metaKey: true, bubbles: true }))
      expect(mockRouterPush).toHaveBeenCalledWith('/app/alerts')
      expect(expandedSections.value.has('alerts')).toBe(true)
    })

    it('Cmd+5 navigates to explore and expands section', () => {
      const { expandedSections } = useSidebar()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', metaKey: true, bubbles: true }))
      expect(mockRouterPush).toHaveBeenCalledWith('/app/explore/metrics')
      expect(expandedSections.value.has('explore')).toBe(true)
    })
  })

  describe('_reset', () => {
    it('clears all state', () => {
      const { isExpanded, expandedSections, toggleSidebar, toggleSection, _reset } = useSidebar()
      toggleSidebar() // collapse
      toggleSection('dashboards')
      toggleSection('explore')

      expect(isExpanded.value).toBe(false)
      expect(expandedSections.value.size).toBe(2)

      // Clear localStorage so _reset reads null -> defaults true
      localStorage.clear()
      _reset()

      const sidebar = useSidebar()
      expect(sidebar.isExpanded.value).toBe(true)
      expect(sidebar.expandedSections.value.size).toBe(0)
    })
  })
})

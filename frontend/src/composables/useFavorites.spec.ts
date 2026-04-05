import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFavorites } from './useFavorites'
import type { FavoriteItem, RecentDashboard } from './useFavorites'

describe('useFavorites', () => {
  beforeEach(() => {
    localStorage.clear()
    const { _reset } = useFavorites()
    _reset()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('toggleFavorite', () => {
    it('adds an item to favorites when not already favorited', () => {
      const { favorites, toggleFavorite } = useFavorites()
      toggleFavorite({ id: 'dash-1', title: 'Dashboard 1' })
      expect(favorites.value).toEqual([
        { id: 'dash-1', title: 'Dashboard 1', type: 'dashboard' },
      ])
    })

    it('removes an item from favorites when already favorited', () => {
      const { favorites, toggleFavorite } = useFavorites()
      toggleFavorite({ id: 'dash-1', title: 'Dashboard 1' })
      expect(favorites.value).toHaveLength(1)

      toggleFavorite({ id: 'dash-1', title: 'Dashboard 1' })
      expect(favorites.value).toHaveLength(0)
    })

    it('handles multiple favorites', () => {
      const { favorites, toggleFavorite } = useFavorites()
      toggleFavorite({ id: 'dash-1', title: 'Dashboard 1' })
      toggleFavorite({ id: 'dash-2', title: 'Dashboard 2' })
      toggleFavorite({ id: 'dash-3', title: 'Dashboard 3', type: 'service' })

      expect(favorites.value).toEqual([
        { id: 'dash-1', title: 'Dashboard 1', type: 'dashboard' },
        { id: 'dash-2', title: 'Dashboard 2', type: 'dashboard' },
        { id: 'dash-3', title: 'Dashboard 3', type: 'service' },
      ])
    })
  })

  describe('isFavorite', () => {
    it('returns true for favorited id', () => {
      const { isFavorite, toggleFavorite } = useFavorites()
      toggleFavorite({ id: 'dash-1', title: 'Dashboard 1' })
      expect(isFavorite('dash-1')).toBe(true)
    })

    it('returns false for non-favorited id', () => {
      const { isFavorite } = useFavorites()
      expect(isFavorite('dash-999')).toBe(false)
    })
  })

  describe('recentDashboards', () => {
    it('tracks visited dashboards', () => {
      const { recentDashboards, addRecent } = useFavorites()
      const dashboard: RecentDashboard = {
        id: 'dash-1',
        title: 'Test Dashboard',
        visitedAt: Date.now(),
      }
      addRecent(dashboard)

      expect(recentDashboards.value).toHaveLength(1)
      expect(recentDashboards.value[0]).toEqual(dashboard)
    })

    it('keeps only the last 10 visited dashboards', () => {
      const { recentDashboards, addRecent } = useFavorites()

      for (let i = 0; i < 12; i++) {
        addRecent({
          id: `dash-${i}`,
          title: `Dashboard ${i}`,
          visitedAt: Date.now() + i,
        })
      }

      expect(recentDashboards.value).toHaveLength(10)
      // Most recent should be first
      expect(recentDashboards.value[0].id).toBe('dash-11')
      expect(recentDashboards.value[9].id).toBe('dash-2')
    })

    it('moves existing dashboard to the top when re-visited', () => {
      const { recentDashboards, addRecent } = useFavorites()
      const now = Date.now()

      addRecent({ id: 'dash-1', title: 'Dashboard 1', visitedAt: now })
      addRecent({ id: 'dash-2', title: 'Dashboard 2', visitedAt: now + 1 })
      addRecent({ id: 'dash-3', title: 'Dashboard 3', visitedAt: now + 2 })

      // Re-visit dash-1
      addRecent({ id: 'dash-1', title: 'Dashboard 1', visitedAt: now + 3 })

      expect(recentDashboards.value).toHaveLength(3)
      expect(recentDashboards.value[0].id).toBe('dash-1')
      expect(recentDashboards.value[0].visitedAt).toBe(now + 3)
    })
  })

  describe('localStorage persistence', () => {
    it('persists favorites to localStorage', () => {
      const { toggleFavorite } = useFavorites()
      toggleFavorite({ id: 'dash-1', title: 'Dashboard 1' })
      toggleFavorite({ id: 'dash-2', title: 'Dashboard 2' })

      const stored = JSON.parse(localStorage.getItem('ace-favorites') ?? '[]')
      expect(stored).toEqual([
        { id: 'dash-1', title: 'Dashboard 1', type: 'dashboard' },
        { id: 'dash-2', title: 'Dashboard 2', type: 'dashboard' },
      ])
    })

    it('persists recents to localStorage', () => {
      const { addRecent } = useFavorites()
      const dashboard: RecentDashboard = {
        id: 'dash-1',
        title: 'Test Dashboard',
        visitedAt: 1000,
      }
      addRecent(dashboard)

      const stored = JSON.parse(localStorage.getItem('ace-recents') ?? '[]')
      expect(stored).toEqual([dashboard])
    })

    it('reads favorites from localStorage on init', () => {
      const items: FavoriteItem[] = [
        { id: 'dash-a', title: 'Dash A', type: 'dashboard' },
        { id: 'dash-b', title: 'Dash B', type: 'service' },
      ]
      localStorage.setItem('ace-favorites', JSON.stringify(items))
      const { _reset } = useFavorites()
      _reset()
      const { favorites } = useFavorites()
      expect(favorites.value).toEqual(items)
    })

    it('reads recents from localStorage on init', () => {
      const recents: RecentDashboard[] = [
        { id: 'dash-1', title: 'Dash 1', visitedAt: 1000 },
      ]
      localStorage.setItem('ace-recents', JSON.stringify(recents))
      const { _reset } = useFavorites()
      _reset()
      const { recentDashboards } = useFavorites()
      expect(recentDashboards.value).toEqual(recents)
    })
  })

  describe('migration from bare strings', () => {
    it('converts bare string favorites to FavoriteItem objects', () => {
      localStorage.setItem('ace-favorites', JSON.stringify(['id-1', 'id-2']))
      const { _reset } = useFavorites()
      _reset()
      const { favorites } = useFavorites()

      expect(favorites.value).toEqual([
        { id: 'id-1', title: '(untitled)', type: 'dashboard' },
        { id: 'id-2', title: '(untitled)', type: 'dashboard' },
      ])

      // Should also persist the migrated format back to localStorage
      const stored = JSON.parse(localStorage.getItem('ace-favorites') ?? '[]')
      expect(stored).toEqual([
        { id: 'id-1', title: '(untitled)', type: 'dashboard' },
        { id: 'id-2', title: '(untitled)', type: 'dashboard' },
      ])
    })
  })
})

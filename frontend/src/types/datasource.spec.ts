import { describe, it, expect } from 'vitest'
import { isMetricsType, isLogsType, dataSourceTypeLabels } from './datasource'
import type { DataSourceType } from './datasource'

describe('datasource types', () => {
  describe('isMetricsType', () => {
    it('returns true for prometheus', () => {
      expect(isMetricsType('prometheus')).toBe(true)
    })

    it('returns true for victoriametrics', () => {
      expect(isMetricsType('victoriametrics')).toBe(true)
    })

    it('returns false for loki', () => {
      expect(isMetricsType('loki')).toBe(false)
    })

    it('returns false for victorialogs', () => {
      expect(isMetricsType('victorialogs')).toBe(false)
    })
  })

  describe('isLogsType', () => {
    it('returns true for loki', () => {
      expect(isLogsType('loki')).toBe(true)
    })

    it('returns true for victorialogs', () => {
      expect(isLogsType('victorialogs')).toBe(true)
    })

    it('returns false for prometheus', () => {
      expect(isLogsType('prometheus')).toBe(false)
    })

    it('returns false for victoriametrics', () => {
      expect(isLogsType('victoriametrics')).toBe(false)
    })
  })

  describe('dataSourceTypeLabels', () => {
    it('has labels for all types', () => {
      const types: DataSourceType[] = ['prometheus', 'loki', 'victorialogs', 'victoriametrics']
      for (const type_ of types) {
        expect(dataSourceTypeLabels[type_]).toBeDefined()
        expect(typeof dataSourceTypeLabels[type_]).toBe('string')
      }
    })

    it('returns correct label for prometheus', () => {
      expect(dataSourceTypeLabels.prometheus).toBe('Prometheus')
    })

    it('returns correct label for loki', () => {
      expect(dataSourceTypeLabels.loki).toBe('Loki')
    })

    it('returns correct label for victorialogs', () => {
      expect(dataSourceTypeLabels.victorialogs).toBe('Victoria Logs')
    })

    it('returns correct label for victoriametrics', () => {
      expect(dataSourceTypeLabels.victoriametrics).toBe('VictoriaMetrics')
    })
  })
})
